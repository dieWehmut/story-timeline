package controller

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/service"
)

type AuthController struct {
	authService     *service.AuthService
	userService     *service.UserService
	emailService    *service.EmailAuthService
	loginLimiter    *service.LoginLimiter
	frontendBaseURL string
	appURLScheme    string
}

func NewAuthController(authService *service.AuthService, userService *service.UserService, emailService *service.EmailAuthService, loginLimiter *service.LoginLimiter, frontendBaseURL string, appURLScheme string) *AuthController {
	return &AuthController{
		authService:     authService,
		userService:     userService,
		emailService:    emailService,
		loginLimiter:    loginLimiter,
		frontendBaseURL: frontendBaseURL,
		appURLScheme:    appURLScheme,
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

	returnTo := sanitizeReturnPath(payload.ReturnTo)
	client := normalizeClient(payload.Client)
	linkBase := controller.emailLinkBaseURL(c.Request, client, returnTo)
	if err := controller.emailService.RequestMagicLink(c.Request.Context(), payload.Email, linkBase); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (controller *AuthController) login(c *gin.Context, provider string) {
	returnTo := sanitizeReturnPath(c.Query("return"))
	client := normalizeClient(c.Query("client"))
	state := controller.authService.NewState()
	controller.authService.SetOAuthStateCookie(c.Writer, state)
	controller.authService.StoreOAuthState(c.Request.Context(), state, service.OAuthStatePayload{
		Client:   client,
		ReturnTo: returnTo,
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

	session, err := controller.authService.CompleteLogin(c.Request.Context(), provider, c.Query("code"), controller.callbackURL(c.Request, provider))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	returnTo := ""
	client := "web"
	if statePayload != nil {
		returnTo = sanitizeReturnPath(statePayload.ReturnTo)
		client = normalizeClient(statePayload.Client)
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
			c.Redirect(http.StatusTemporaryRedirect, controller.appAuthURL("/callback", exchangeToken, returnTo))
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
		},
	})
}

func (controller *AuthController) Logout(c *gin.Context) {
	controller.authService.ClearSession(c.Writer)
	c.JSON(http.StatusOK, gin.H{"ok": true})
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
