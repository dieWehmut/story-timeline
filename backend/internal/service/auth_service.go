package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	githuboauth "github.com/dieWehmut/story-timeline/backend/internal/github"
	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

const (
	sessionCookieName = "story_session"
	stateCookieName   = "story_oauth_state"
)

type AuthService struct {
	oauth         *githuboauth.OAuthClient
	signingSecret []byte
	secureCookies bool
}

func NewAuthService(oauth *githuboauth.OAuthClient, secret string, secureCookies bool) *AuthService {
	return &AuthService{
		oauth:         oauth,
		signingSecret: []byte(secret),
		secureCookies: secureCookies,
	}
}

func (service *AuthService) NewState() string {
	return utils.NewID()
}

func (service *AuthService) LoginURL(state string) string {
	return service.oauth.AuthCodeURL(state)
}

func (service *AuthService) SetOAuthStateCookie(w http.ResponseWriter, state string) {
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   service.secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})
}

func (service *AuthService) ValidateState(r *http.Request, incoming string) bool {
	stateCookie, err := r.Cookie(stateCookieName)
	if err != nil {
		return false
	}

	return incoming != "" && stateCookie.Value == incoming
}

func (service *AuthService) CompleteLogin(ctx context.Context, code string) (model.Session, error) {
	token, err := service.oauth.Exchange(ctx, code)
	if err != nil {
		return model.Session{}, err
	}

	user, err := service.oauth.FetchUser(ctx, token.AccessToken)
	if err != nil {
		return model.Session{}, err
	}

	return model.Session{
		AccessToken: token.AccessToken,
		User:        user,
		ExpiresAt:   time.Now().Add(7 * 24 * time.Hour),
	}, nil
}

func (service *AuthService) SetSessionCookie(w http.ResponseWriter, session model.Session) error {
	rawPayload, err := json.Marshal(session)
	if err != nil {
		return err
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(rawPayload)
	signature := service.sign(encodedPayload)

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    fmt.Sprintf("%s.%s", encodedPayload, signature),
		Path:     "/",
		HttpOnly: true,
		Secure:   service.secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((7 * 24 * time.Hour).Seconds()),
	})

	return nil
}

func (service *AuthService) ReadSession(r *http.Request) (*model.Session, error) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return nil, err
	}

	parts := strings.Split(cookie.Value, ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid session cookie")
	}

	if !hmac.Equal([]byte(service.sign(parts[0])), []byte(parts[1])) {
		return nil, errors.New("session signature mismatch")
	}

	rawPayload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, err
	}

	var session model.Session
	if err := json.Unmarshal(rawPayload, &session); err != nil {
		return nil, err
	}

	if session.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("session expired")
	}

	return &session, nil
}

func (service *AuthService) ClearSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   service.secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   service.secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func (service *AuthService) sign(payload string) string {
	h := hmac.New(sha256.New, service.signingSecret)
	_, _ = h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}