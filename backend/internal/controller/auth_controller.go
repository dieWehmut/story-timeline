package controller

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/service"
)

type AuthController struct {
	authService     *service.AuthService
	userService     *service.UserService
	frontendBaseURL string
}

func NewAuthController(authService *service.AuthService, userService *service.UserService, frontendBaseURL string) *AuthController {
	return &AuthController{
		authService:     authService,
		userService:     userService,
		frontendBaseURL: frontendBaseURL,
	}
}

func (controller *AuthController) GitHubLogin(c *gin.Context) {
	controller.login(c, "github")
}

func (controller *AuthController) GoogleLogin(c *gin.Context) {
	controller.login(c, "google")
}

func (controller *AuthController) login(c *gin.Context, provider string) {
	state := controller.authService.NewState()
	controller.authService.SetOAuthStateCookie(c.Writer, state)
	c.Redirect(http.StatusTemporaryRedirect, controller.authService.LoginURL(provider, state, controller.callbackURL(c.Request, provider)))
}

func (controller *AuthController) GitHubCallback(c *gin.Context) {
	controller.callback(c, "github")
}

func (controller *AuthController) GoogleCallback(c *gin.Context) {
	controller.callback(c, "google")
}

func (controller *AuthController) callback(c *gin.Context, provider string) {
	if !controller.authService.ValidateState(c.Request, c.Query("state")) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid oauth state"})
		return
	}

	session, err := controller.authService.CompleteLogin(c.Request.Context(), provider, c.Query("code"), controller.callbackURL(c.Request, provider))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	if err := controller.authService.SetSessionCookie(c.Writer, session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if controller.userService != nil && session.User.Provider == "github" {
		_ = controller.userService.SyncGitHubFollows(c.Request.Context(), session.AccessToken, session.User.Login)
	}

	c.Redirect(http.StatusTemporaryRedirect, controller.publicBaseURL(c.Request))
}

func (controller *AuthController) Session(c *gin.Context) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"authenticated": false,
			"loginUrl":      "/api/auth/github/login",
			"googleLoginUrl": "/api/auth/google/login",
			"isAdmin":       false,
			"canPost":       false,
			"roleLabel":     "游客",
			"user":          nil,
		})
		return
	}

	isAdmin := controller.authService.IsAdmin(session.User.Login)
	roleLabel := "用户"
	if isAdmin {
		roleLabel = "管理员"
	}

	c.JSON(http.StatusOK, gin.H{
		"authenticated": true,
		"loginUrl":      "/api/auth/github/login",
		"googleLoginUrl": "/api/auth/google/login",
		"isAdmin":       isAdmin,
		"canPost":       true,
		"roleLabel":     roleLabel,
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
