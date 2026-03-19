package controller

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

type AuthController struct {
	authService         *service.AuthService
	userService         *service.UserService
	emailService        *service.EmailAuthService
	registrationService *service.RegistrationService
	loginLimiter        *service.LoginLimiter
	redisStore          *storage.Store
	frontendBaseURL     string
	appURLScheme        string
}

func NewAuthController(authService *service.AuthService, userService *service.UserService, emailService *service.EmailAuthService, registrationService *service.RegistrationService, loginLimiter *service.LoginLimiter, redisStore *storage.Store, frontendBaseURL string, appURLScheme string) *AuthController {
	return &AuthController{
		authService:         authService,
		userService:         userService,
		emailService:        emailService,
		registrationService: registrationService,
		loginLimiter:        loginLimiter,
		redisStore:          redisStore,
		frontendBaseURL:     frontendBaseURL,
		appURLScheme:        appURLScheme,
	}
}

func (controller *AuthController) GitHubLogin(c *gin.Context) {
	if !controller.checkLoginLimit(c) {
		return
	}
	controller.login(c, "github")
}

func (controller *AuthController) GoogleLogin(c *gin.Context) {
	if !controller.checkLoginLimit(c) {
		return
	}
	controller.login(c, "google")
}

func (controller *AuthController) EmailLogin(c *gin.Context) {
	if !controller.checkLoginLimit(c) {
		return
	}
	if controller.emailService == nil || !controller.emailService.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email login not configured"})
		return
	}

	var payload struct {
		Email    string `json:"email"`
		ReturnTo string `json:"returnTo"`
		Client   string `json:"client"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Check if user exists before sending email
	if controller.registrationService != nil && controller.registrationService.Enabled() {
		email := strings.TrimSpace(payload.Email)
		if !controller.authService.IsAdminEmail(email) {
			user, _ := controller.registrationService.GetUserByEmail(c.Request.Context(), email)
			if user == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "user_not_registered"})
				return
			}
			status, _ := user["status"].(string)
			if status == "pending" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "user_pending"})
				return
			}
			if status == "rejected" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "user_rejected"})
				return
			}
		}
	}

	returnTo := sanitizeReturnPath(payload.ReturnTo)
	client := normalizeClient(payload.Client)
	linkBase := controller.emailLinkBaseURL(c.Request, client, returnTo)
	tokenHash, err := controller.emailService.RequestMagicLink(c.Request.Context(), payload.Email, linkBase)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	loginId := newLoginId()
	if controller.redisStore != nil && controller.redisStore.Enabled() {
		_ = controller.redisStore.SetEmailPendingLogin(c.Request.Context(), loginId, tokenHash)
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "loginId": loginId})
}

func (controller *AuthController) login(c *gin.Context, provider string) {
	returnTo := sanitizeReturnPath(c.Query("return"))
	client := normalizeClient(c.Query("client"))
	nonce := strings.TrimSpace(c.Query("nonce"))
	state := controller.authService.NewState()
	controller.authService.SetOAuthStateCookie(c.Writer, state)
	controller.authService.StoreOAuthState(c.Request.Context(), state, service.OAuthStatePayload{
		Client:   client,
		ReturnTo: returnTo,
		Nonce:    nonce,
	})
	c.Redirect(http.StatusTemporaryRedirect, controller.authService.LoginURL(provider, state, controller.callbackURL(c.Request, provider)))
}

func (controller *AuthController) GitHubCallback(c *gin.Context) {
	controller.callback(c, "github")
}

func (controller *AuthController) GoogleCallback(c *gin.Context) {
	controller.callback(c, "google")
}

func (controller *AuthController) EmailCallback(c *gin.Context) {
	if controller.emailService == nil || !controller.emailService.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email login not configured"})
		return
	}

	token := c.Query("token")
	session, err := controller.emailService.CompleteLogin(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// For email login, look up registered user by email and use their actual login
	if controller.registrationService != nil && controller.registrationService.Enabled() {
		email := session.User.ID // For email provider, ID is the email
		registeredUser, _ := controller.registrationService.GetUserByEmail(c.Request.Context(), email)
		if registeredUser != nil {
			login, _ := registeredUser["login"].(string)
			if login != "" {
				session.User.Login = login
			}
		}
	}

	// Check registration status for email login — skip for admin
	if controller.registrationService != nil && controller.registrationService.Enabled() && !controller.authService.IsAdmin(session.User.Login) {
		userStatus := controller.checkUserRegistrationStatus(c, session.User)
		if userStatus != "" && userStatus != "active" {
			return
		}
	}

	if err := controller.authService.SetSessionCookie(c.Writer, session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if controller.userService != nil {
		_ = controller.userService.UpsertUser(c.Request.Context(), session.User)
	}

	returnTo := sanitizeReturnPath(c.Query("return"))
	c.Redirect(http.StatusTemporaryRedirect, controller.redirectTarget(c.Request, returnTo))
}

func (controller *AuthController) callback(c *gin.Context, provider string) {
	stateValue := c.Query("state")
	statePayload, stateOK := controller.authService.ConsumeOAuthState(c.Request.Context(), stateValue)
	if !controller.authService.ValidateState(c.Request, stateValue) && !stateOK {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid oauth state"})
		return
	}

	// Check if this is an account binding flow
	if statePayload != nil && statePayload.Bind {
		controller.handleBindCallback(c, provider, statePayload)
		return
	}

	session, err := controller.authService.CompleteLogin(c.Request.Context(), provider, c.Query("code"), controller.callbackURL(c.Request, provider))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	// Check if this identity is linked to an existing user via user_identities
	identityFound := false
	if controller.userService != nil {
		linkedLogin, found, _ := controller.userService.FindUserByIdentity(c.Request.Context(), provider, session.User.ID)
		if found && linkedLogin != "" {
			// Use the linked user's login instead
			session.User.Login = linkedLogin
			identityFound = true
		}
	}

	// If no identity binding found and we have an email, try to find user by email and auto-bind
	if !identityFound && session.User.Email != "" && controller.registrationService != nil && controller.registrationService.Enabled() {
		registeredUser, _ := controller.registrationService.GetUserByEmail(c.Request.Context(), session.User.Email)
		if registeredUser != nil {
			status, _ := registeredUser["status"].(string)
			login, _ := registeredUser["login"].(string)
			if status == "active" && login != "" {
				// User is registered and active - auto-bind this identity
				session.User.Login = login
				if controller.userService != nil {
					_ = controller.userService.CreateUserIdentity(c.Request.Context(), login, provider, session.User.ID, session.User.Email)
				}
				identityFound = true
			}
		}
	}

	// Check registration status — skip check for admin
	if controller.registrationService != nil && controller.registrationService.Enabled() && !controller.authService.IsAdmin(session.User.Login) {
		userStatus := controller.checkUserRegistrationStatus(c, session.User)
		if userStatus != "" && userStatus != "active" {
			return // response already sent by checkUserRegistrationStatus
		}
	}

	returnTo := ""
	client := "web"
	nonce := ""
	if statePayload != nil {
		returnTo = sanitizeReturnPath(statePayload.ReturnTo)
		client = normalizeClient(statePayload.Client)
		nonce = strings.TrimSpace(statePayload.Nonce)
	}

	if client == "app" {
		exchangeToken, exchangeErr := controller.authService.CreateExchangeToken(c.Request.Context(), session)
		if exchangeErr == nil {
			if controller.userService != nil {
				_ = controller.userService.UpsertUser(c.Request.Context(), session.User)
				if session.User.Provider == "github" {
					_ = controller.userService.SyncGitHubFollows(c.Request.Context(), session.AccessToken, session.User.Login)
				}
			}
			// Store exchange token indexed by nonce so the app can poll for it
			if nonce != "" && controller.redisStore != nil && controller.redisStore.Enabled() {
				_ = controller.redisStore.SetAppOAuthPending(c.Request.Context(), nonce, exchangeToken)
			}
			deepLink := controller.appAuthURL("/callback", exchangeToken, returnTo)
			controller.renderAppRedirect(c, deepLink)
			return
		}
	}

	if err := controller.authService.SetSessionCookie(c.Writer, session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if controller.userService != nil {
		_ = controller.userService.UpsertUser(c.Request.Context(), session.User)
		if session.User.Provider == "github" {
			_ = controller.userService.SyncGitHubFollows(c.Request.Context(), session.AccessToken, session.User.Login)
		}
	}

	c.Redirect(http.StatusTemporaryRedirect, controller.redirectTarget(c.Request, returnTo))
}

// handleBindCallback handles OAuth callback for account binding
func (controller *AuthController) handleBindCallback(c *gin.Context, provider string, statePayload *service.OAuthStatePayload) {
	// Get the user info from OAuth provider
	session, err := controller.authService.CompleteLogin(c.Request.Context(), provider, c.Query("code"), controller.callbackURL(c.Request, provider))
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?error=oauth_failed")
		return
	}

	// Check if this identity is already bound to another user
	existingLogin, found, err := controller.userService.FindUserByIdentity(c.Request.Context(), provider, session.User.ID)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?error=db_error")
		return
	}
	if found {
		if existingLogin == statePayload.BindUser {
			// Already bound to the same user
			c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?bind=already")
			return
		}
		// Bound to a different user
		c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?error=already_bound")
		return
	}

	// Create the identity binding
	email := ""
	if err := controller.userService.CreateUserIdentity(c.Request.Context(), statePayload.BindUser, provider, session.User.ID, email); err != nil {
		c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?error=bind_failed")
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?bind=success")
}

func (controller *AuthController) ExchangeSession(c *gin.Context) {
	var payload struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	session, err := controller.authService.ConsumeExchangeToken(c.Request.Context(), payload.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := controller.authService.SetSessionCookie(c.Writer, session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if controller.userService != nil {
		_ = controller.userService.UpsertUser(c.Request.Context(), session.User)
		if session.User.Provider == "github" {
			_ = controller.userService.SyncGitHubFollows(c.Request.Context(), session.AccessToken, session.User.Login)
		}
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (controller *AuthController) EmailExchange(c *gin.Context) {
	if controller.emailService == nil || !controller.emailService.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email login not configured"})
		return
	}

	var payload struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	session, err := controller.emailService.CompleteLogin(c.Request.Context(), payload.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := controller.authService.SetSessionCookie(c.Writer, session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if controller.userService != nil {
		_ = controller.userService.UpsertUser(c.Request.Context(), session.User)
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (controller *AuthController) EmailVerify(c *gin.Context) {
	if controller.emailService == nil || !controller.emailService.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email login not configured"})
		return
	}

	var payload struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := controller.emailService.VerifyToken(c.Request.Context(), payload.Token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (controller *AuthController) EmailConfirm(c *gin.Context) {
	if controller.emailService == nil || !controller.emailService.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email login not configured"})
		return
	}

	var payload struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	session, tokenHash, err := controller.emailService.ConfirmLogin(c.Request.Context(), payload.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// For email login, look up registered user by email and use their actual login
	if controller.registrationService != nil && controller.registrationService.Enabled() {
		email := session.User.ID // For email provider, ID is the email
		registeredUser, _ := controller.registrationService.GetUserByEmail(c.Request.Context(), email)
		if registeredUser != nil {
			login, _ := registeredUser["login"].(string)
			if login != "" {
				session.User.Login = login
			}
		}
	}

	if controller.userService != nil {
		_ = controller.userService.UpsertUser(c.Request.Context(), session.User)
	}

	// Set session cookie immediately so user is logged in right away
	if err := controller.authService.SetSessionCookie(c.Writer, session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if controller.redisStore != nil && controller.redisStore.Enabled() {
		sessionJSON, err := json.Marshal(session)
		if err == nil {
			_ = controller.redisStore.SetEmailConfirmedSession(c.Request.Context(), tokenHash, string(sessionJSON))
		}
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (controller *AuthController) AppOAuthPoll(c *gin.Context) {
	var payload struct {
		Nonce string `json:"nonce"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	nonce := strings.TrimSpace(payload.Nonce)
	if nonce == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing nonce"})
		return
	}

	if controller.redisStore == nil || !controller.redisStore.Enabled() {
		c.JSON(http.StatusOK, gin.H{"ok": true, "authenticated": false})
		return
	}

	exchangeToken, err := controller.redisStore.ConsumeAppOAuthPending(c.Request.Context(), nonce)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": true, "authenticated": false})
		return
	}

	session, err := controller.authService.ConsumeExchangeToken(c.Request.Context(), exchangeToken)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": true, "authenticated": false})
		return
	}

	if err := controller.authService.SetSessionCookie(c.Writer, session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if controller.userService != nil {
		_ = controller.userService.UpsertUser(c.Request.Context(), session.User)
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "authenticated": true})
}

func (controller *AuthController) EmailPoll(c *gin.Context) {
	var payload struct {
		LoginId string `json:"loginId"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	loginId := strings.TrimSpace(payload.LoginId)
	if loginId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing loginId"})
		return
	}

	if controller.redisStore == nil || !controller.redisStore.Enabled() {
		c.JSON(http.StatusOK, gin.H{"ok": true, "authenticated": false})
		return
	}

	tokenHash, err := controller.redisStore.GetEmailPendingLogin(c.Request.Context(), loginId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": true, "authenticated": false})
		return
	}

	sessionJSON, err := controller.redisStore.ConsumeEmailConfirmedSession(c.Request.Context(), tokenHash)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": true, "authenticated": false})
		return
	}

	var session model.Session
	if err := json.Unmarshal([]byte(sessionJSON), &session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session decode failed"})
		return
	}

	if err := controller.authService.SetSessionCookie(c.Writer, session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if controller.userService != nil {
		_ = controller.userService.UpsertUser(c.Request.Context(), session.User)
	}

	_ = controller.redisStore.DeleteEmailPendingLogin(c.Request.Context(), loginId)

	c.JSON(http.StatusOK, gin.H{"ok": true, "authenticated": true})
}

func (controller *AuthController) UpdateProfile(c *gin.Context) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	var payload struct {
		DisplayName *string `json:"displayName"`
		AvatarURL   *string `json:"avatarUrl"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if payload.DisplayName == nil && payload.AvatarURL == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no profile updates"})
		return
	}

	var displayName *string
	if payload.DisplayName != nil {
		trimmed := strings.TrimSpace(*payload.DisplayName)
		displayName = &trimmed
		session.User.DisplayName = trimmed
	}

	var avatarURL *string
	if payload.AvatarURL != nil {
		trimmed := strings.TrimSpace(*payload.AvatarURL)
		if trimmed == "" {
			trimmed = defaultAvatarFor(session.User.Login, session.User.Provider, session.User.AvatarURL)
		}
		avatarURL = &trimmed
		session.User.AvatarURL = trimmed
	}

	if controller.userService != nil {
		if err := controller.userService.UpdateProfile(c.Request.Context(), session.User.Login, displayName, avatarURL); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
	}

	if err := controller.authService.SetSessionCookie(c.Writer, *session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"user": gin.H{
			"provider":    session.User.Provider,
			"id":          session.User.ID,
			"login":       session.User.Login,
			"avatarUrl":   session.User.AvatarURL,
			"displayName": session.User.DisplayName,
		},
	})
}

func (controller *AuthController) GetEmailBinding(c *gin.Context) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	if controller.userService == nil {
		c.JSON(http.StatusOK, gin.H{"ok": true, "email": ""})
		return
	}

	email, err := controller.userService.GetEmail(c.Request.Context(), session.User.Login)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "email": email})
}

func (controller *AuthController) SetEmailBinding(c *gin.Context) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	var payload struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	email := strings.TrimSpace(payload.Email)
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email required"})
		return
	}

	if controller.userService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "user service unavailable"})
		return
	}

	if err := controller.userService.UpdateEmail(c.Request.Context(), session.User.Login, email); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (controller *AuthController) Session(c *gin.Context) {
	emailLoginURL := ""
	if controller.emailService != nil && controller.emailService.Enabled() {
		emailLoginURL = "/api/auth/email/login"
	}

	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"authenticated":  false,
			"loginUrl":       "/api/auth/github/login",
			"googleLoginUrl": "/api/auth/google/login",
			"emailLoginUrl":  emailLoginURL,
			"isAdmin":        false,
			"canPost":        false,
			"roleLabel":      "游客",
			"user":           nil,
		})
		return
	}

	originalUser := session.User
	if controller.userService != nil {
		if profile, err := controller.userService.GetUser(c.Request.Context(), session.User.Login); err == nil {
			session.User.DisplayName = profile.DisplayName
			session.User.AvatarURL = profile.AvatarURL
		}
	}

	if session.User.DisplayName != originalUser.DisplayName || session.User.AvatarURL != originalUser.AvatarURL {
		_ = controller.authService.SetSessionCookie(c.Writer, *session)
	}

	isAdmin := controller.authService.IsAdmin(session.User.Login)
	roleLabel := "用户"
	if isAdmin {
		roleLabel = "管理员"
	}

	c.JSON(http.StatusOK, gin.H{
		"authenticated":  true,
		"loginUrl":       "/api/auth/github/login",
		"googleLoginUrl": "/api/auth/google/login",
		"emailLoginUrl":  emailLoginURL,
		"isAdmin":        isAdmin,
		"canPost":        true,
		"roleLabel":      roleLabel,
		"user": gin.H{
			"provider":  session.User.Provider,
			"id":        session.User.ID,
			"login":     session.User.Login,
			"avatarUrl": session.User.AvatarURL,
			"displayName": session.User.DisplayName,
		},
	})
}

func (controller *AuthController) Logout(c *gin.Context) {
	controller.authService.ClearSession(c.Writer)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// checkUserRegistrationStatus checks if a user is registered and approved.
// Returns the status string ("pending", "rejected", "active", or "" if not registered).
// If the user is blocked, it sends the response and returns the status.
func (controller *AuthController) checkUserRegistrationStatus(c *gin.Context, user model.AuthUser) string {
	if controller.registrationService == nil {
		return "active"
	}
	// Try to find user by login first
	status, _ := controller.registrationService.GetUserStatus(c.Request.Context(), user.Login)
	if status == "" {
		// Try by email (for OAuth users whose login may differ)
		email := user.ID // For email provider, ID is the email
		if user.Provider != "email" {
			email = "" // OAuth providers don't have email in ID directly
		}
		if email != "" {
			existing, _ := controller.registrationService.GetUserByEmail(c.Request.Context(), email)
			if existing != nil {
				status, _ = existing["status"].(string)
			}
		}
	}
	switch status {
	case "active":
		return "active"
	case "pending":
		base := strings.TrimRight(controller.frontendBaseURL, "/")
		c.Redirect(http.StatusTemporaryRedirect, base+"/login?error=pending")
		return "pending"
	case "rejected":
		base := strings.TrimRight(controller.frontendBaseURL, "/")
		c.Redirect(http.StatusTemporaryRedirect, base+"/login?error=rejected")
		return "rejected"
	default:
		// User not found in registration system — redirect to login with not_registered error
		base := strings.TrimRight(controller.frontendBaseURL, "/")
		c.Redirect(http.StatusTemporaryRedirect, base+"/login?error=not_registered")
		return "not_found"
	}
}

func (controller *AuthController) checkLoginLimit(c *gin.Context) bool {
	if controller.loginLimiter == nil || !controller.loginLimiter.Enabled() {
		return true
	}

	allowed, count, ttl, err := controller.loginLimiter.Allow(c.Request.Context(), c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return false
	}
	if allowed {
		return true
	}

	retryAfter := int(ttl.Seconds())
	if retryAfter < 0 {
		retryAfter = 0
	}
	if retryAfter > 0 {
		c.Header("Retry-After", strconv.Itoa(retryAfter))
	}

	c.JSON(http.StatusTooManyRequests, gin.H{
		"error":             "too many login attempts",
		"retryAfterSeconds": retryAfter,
		"attempts":          count,
	})
	return false
}

func (controller *AuthController) callbackURL(r *http.Request, provider string) string {
	return strings.TrimRight(controller.publicBaseURL(r), "/") + "/api/auth/" + provider + "/callback"
}

func (controller *AuthController) publicBaseURL(r *http.Request) string {
	host := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = strings.TrimSpace(r.Host)
	}
	if host != "" {
		scheme := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto"))
		if scheme == "" {
			scheme = "https"
			if r.TLS == nil {
				scheme = "http"
			}
		}

		return scheme + "://" + host
	}

	return strings.TrimRight(controller.frontendBaseURL, "/")
}

func (controller *AuthController) redirectTarget(r *http.Request, returnTo string) string {
	base := strings.TrimRight(controller.publicBaseURL(r), "/")
	if returnTo == "" {
		return base
	}
	if strings.HasPrefix(returnTo, "/") {
		return base + returnTo
	}
	return base
}

func normalizeClient(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "app":
		return "app"
	default:
		return "web"
	}
}

func sanitizeReturnPath(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if !strings.HasPrefix(trimmed, "/") {
		return ""
	}
	if strings.HasPrefix(trimmed, "//") {
		return ""
	}
	if strings.Contains(trimmed, "://") {
		return ""
	}
	if strings.Contains(trimmed, "\\") {
		return ""
	}
	// Don't redirect back to auth pages after successful login
	if trimmed == "/login" || trimmed == "/register" || strings.HasPrefix(trimmed, "/login?") || strings.HasPrefix(trimmed, "/register?") {
		return ""
	}
	return trimmed
}

func (controller *AuthController) appScheme() string {
	scheme := strings.TrimSpace(controller.appURLScheme)
	scheme = strings.TrimSuffix(scheme, "://")
	if scheme == "" {
		scheme = "storytimeline.me"
	}
	return scheme
}

func (controller *AuthController) appAuthBase(path string, returnTo string) string {
	u := url.URL{
		Scheme: controller.appScheme(),
		Host:   "auth",
		Path:   path,
	}
	if returnTo != "" {
		query := url.Values{}
		query.Set("return", returnTo)
		u.RawQuery = query.Encode()
	}
	return u.String()
}

func (controller *AuthController) appAuthURL(path string, token string, returnTo string) string {
	u := url.URL{
		Scheme: controller.appScheme(),
		Host:   "auth",
		Path:   path,
	}
	query := url.Values{}
	query.Set("token", token)
	if returnTo != "" {
		query.Set("return", returnTo)
	}
	u.RawQuery = query.Encode()
	return u.String()
}

func defaultAvatarFor(login string, provider string, fallback string) string {
	trimmedLogin := strings.TrimSpace(login)
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "github":
		if trimmedLogin == "" {
			return fallback
		}
		return fmt.Sprintf("https://github.com/%s.png?size=64", trimmedLogin)
	case "email":
		if trimmedLogin == "" {
			return fallback
		}
		return fmt.Sprintf("https://ui-avatars.com/api/?name=%s&background=0D1117&color=ffffff&size=128", url.QueryEscape(trimmedLogin))
	default:
		if strings.TrimSpace(fallback) != "" {
			return fallback
		}
		return ""
	}
}

func (controller *AuthController) emailLinkBaseURL(r *http.Request, client string, returnTo string) string {
	base := strings.TrimRight(controller.publicBaseURL(r), "/") + "/auth/email"
	params := url.Values{}
	if returnTo != "" {
		params.Set("return", returnTo)
	}
	if client != "" {
		params.Set("client", client)
	}
	if client == "app" {
		params.Set("appScheme", controller.appScheme())
	}
	if len(params) == 0 {
		return base
	}
	return base + "?" + params.Encode()
}

func (controller *AuthController) buildIntentURL(deepLink string) string {
	parsed, err := url.Parse(deepLink)
	if err != nil {
		return ""
	}
	scheme := controller.appScheme()
	hostPath := parsed.Host
	if parsed.Path != "" {
		hostPath += parsed.Path
	}
	intentURL := fmt.Sprintf("intent://%s", hostPath)
	if parsed.RawQuery != "" {
		intentURL += "?" + parsed.RawQuery
	}
	intentURL += fmt.Sprintf("#Intent;scheme=%s;package=%s;end", scheme, scheme)
	return intentURL
}

func (controller *AuthController) renderAppRedirect(c *gin.Context, deepLink string) {
	intentURL := controller.buildIntentURL(deepLink)
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0b0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="text-align:center;padding:24px;">
<p style="font-size:16px;margin-bottom:16px;">正在跳转到 App...</p>
<a href="%s" style="display:inline-block;padding:12px 28px;background:#ff7bbd;border-radius:999px;color:#2a0e1a;text-decoration:none;font-weight:700;font-size:15px;">如果没有自动跳转，请点击这里</a>
</div>
<script>
(function(){
  var deep=%q;
  var intent=%q;
  if(/android/i.test(navigator.userAgent)&&intent){
    window.location.href=intent;
  }else{
    window.location.href=deep;
  }
})();
</script>
</body>
</html>`, deepLink, deepLink, intentURL)
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}

func newLoginId() string {
	raw := make([]byte, 16)
	_, _ = rand.Read(raw)
	return hex.EncodeToString(raw)
}

// --- Account Binding APIs ---

// GetIdentities returns all linked identities for the current user
func (controller *AuthController) GetIdentities(c *gin.Context) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not logged in"})
		return
	}

	identities, err := controller.userService.GetUserIdentities(c.Request.Context(), session.User.Login)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "identities": identities})
}

// StartBindGitHub initiates GitHub account binding
func (controller *AuthController) StartBindGitHub(c *gin.Context) {
	controller.startBind(c, "github")
}

// StartBindGoogle initiates Google account binding
func (controller *AuthController) StartBindGoogle(c *gin.Context) {
	controller.startBind(c, "google")
}

func (controller *AuthController) startBind(c *gin.Context, provider string) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not logged in"})
		return
	}

	// Generate state with bind marker
	state := generateRandomState()
	statePayload := service.OAuthStatePayload{
		ReturnTo: "/config",
		Client:   "web",
		Nonce:    "",
		Bind:     true,
		BindUser: session.User.Login,
	}

	if controller.redisStore != nil && controller.redisStore.Enabled() {
		controller.authService.StoreOAuthState(c.Request.Context(), state, statePayload)
	}
	controller.authService.SetOAuthStateCookie(c.Writer, state)

	// Use the same callback URL as regular login - the state will indicate it's a bind operation
	authURL := controller.authService.LoginURL(provider, state, controller.callbackURL(c.Request, provider))
	c.JSON(http.StatusOK, gin.H{"ok": true, "url": authURL})
}

// BindGitHubCallback handles GitHub binding callback (redirects to regular callback)
func (controller *AuthController) BindGitHubCallback(c *gin.Context) {
	controller.callback(c, "github")
}

// BindGoogleCallback handles Google binding callback (redirects to regular callback)
func (controller *AuthController) BindGoogleCallback(c *gin.Context) {
	controller.callback(c, "google")
}

// BindEmail starts email binding by sending verification email
func (controller *AuthController) BindEmail(c *gin.Context) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not logged in"})
		return
	}

	var payload struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	email := strings.TrimSpace(payload.Email)
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email required"})
		return
	}

	// Check if this email is already bound
	existingLogin, found, err := controller.userService.FindUserByIdentityEmail(c.Request.Context(), email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if found && existingLogin != session.User.Login {
		c.JSON(http.StatusConflict, gin.H{"error": "email_already_bound"})
		return
	}

	// Send verification email using email auth service
	if controller.emailService == nil || !controller.emailService.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email service not configured"})
		return
	}

	// Create a special bind token
	linkBase := controller.frontendBaseURL + "/api/auth/bind/email/verify"
	err = controller.emailService.SendBindingEmail(c.Request.Context(), email, session.User.Login, linkBase)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "verification email sent"})
}

// VerifyEmailBinding completes email binding
func (controller *AuthController) VerifyEmailBinding(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?error=invalid_token")
		return
	}

	if controller.emailService == nil {
		c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?error=service_unavailable")
		return
	}

	login, email, err := controller.emailService.VerifyBindingToken(c.Request.Context(), token)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?error="+url.QueryEscape(err.Error()))
		return
	}

	// Create the identity binding
	if err := controller.userService.CreateUserIdentity(c.Request.Context(), login, "email", email, email); err != nil {
		c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?error=bind_failed")
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL+"/config?bind=success")
}

// Unbind removes a linked identity
func (controller *AuthController) Unbind(c *gin.Context) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not logged in"})
		return
	}

	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider required"})
		return
	}

	// Check that user has at least 2 identities
	count, err := controller.userService.CountUserIdentities(c.Request.Context(), session.User.Login)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Also count the original provider in users table
	// If user has 0 identities but has users.provider, they still have 1 login method
	if count <= 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_unbind_last_identity"})
		return
	}

	if err := controller.userService.DeleteUserIdentity(c.Request.Context(), session.User.Login, provider); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func generateRandomState() string {
	raw := make([]byte, 16)
	_, _ = rand.Read(raw)
	return hex.EncodeToString(raw)
}
