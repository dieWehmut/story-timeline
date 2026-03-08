package controller

import (
	"net/http"

	"github.com/dieWehmut/inner/backend/internal/dto"
	"github.com/dieWehmut/inner/backend/internal/service"
)

type AuthController struct {
	authService     *service.AuthService
	frontendBaseURL string
}

func NewAuthController(authService *service.AuthService, frontendBaseURL string) *AuthController {
	return &AuthController{authService: authService, frontendBaseURL: frontendBaseURL}
}

func (controller *AuthController) Login(w http.ResponseWriter, r *http.Request) {
	state := controller.authService.NewState()
	controller.authService.SetOAuthStateCookie(w, state)
	http.Redirect(w, r, controller.authService.LoginURL(state), http.StatusTemporaryRedirect)
}

func (controller *AuthController) Callback(w http.ResponseWriter, r *http.Request) {
	if !controller.authService.ValidateState(r, r.URL.Query().Get("state")) {
		dto.WriteError(w, http.StatusBadRequest, "invalid oauth state")
		return
	}

	session, err := controller.authService.CompleteLogin(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	if err := controller.authService.SetSessionCookie(w, session); err != nil {
		dto.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	http.Redirect(w, r, controller.frontendBaseURL, http.StatusTemporaryRedirect)
}

func (controller *AuthController) Session(w http.ResponseWriter, r *http.Request) {
	session, err := controller.authService.ReadSession(r)
	if err != nil {
		dto.WriteJSON(w, http.StatusOK, map[string]any{
			"authenticated": false,
			"loginUrl":      "/api/auth/github/login",
			"user":          nil,
		})
		return
	}

	dto.WriteJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"loginUrl":      "/api/auth/github/login",
		"user": map[string]any{
			"id":        session.User.ID,
			"login":     session.User.Login,
			"avatarUrl": session.User.AvatarURL,
		},
	})
}

func (controller *AuthController) Logout(w http.ResponseWriter, r *http.Request) {
	controller.authService.ClearSession(w)
	dto.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}