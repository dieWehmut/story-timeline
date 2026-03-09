package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/service"
)

type AuthController struct {
	authService     *service.AuthService
	frontendBaseURL string
}

func NewAuthController(authService *service.AuthService, frontendBaseURL string) *AuthController {
	return &AuthController{authService: authService, frontendBaseURL: frontendBaseURL}
}

func (controller *AuthController) Login(c *gin.Context) {
	state := controller.authService.NewState()
	controller.authService.SetOAuthStateCookie(c.Writer, state)
	c.Redirect(http.StatusTemporaryRedirect, controller.authService.LoginURL(state))
}

func (controller *AuthController) Callback(c *gin.Context) {
	if !controller.authService.ValidateState(c.Request, c.Query("state")) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid oauth state"})
		return
	}

	session, err := controller.authService.CompleteLogin(c.Request.Context(), c.Query("code"))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	if err := controller.authService.SetSessionCookie(c.Writer, session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, controller.frontendBaseURL)
}

func (controller *AuthController) Session(c *gin.Context) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"authenticated": false,
			"loginUrl":      "/api/auth/github/login",
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
		"isAdmin":       isAdmin,
		"canPost":       true,
		"roleLabel":     roleLabel,
		"user": gin.H{
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