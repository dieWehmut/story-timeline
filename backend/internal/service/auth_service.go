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
	googleoauth "github.com/dieWehmut/story-timeline/backend/internal/google"
	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

const (
	sessionCookieName = "story_session"
	stateCookieName   = "story_oauth_state"
)

type AuthService struct {
	oauth         *githuboauth.OAuthClient
	googleOAuth   *googleoauth.OAuthClient
	graphql       *githuboauth.GraphQLClient
	signingSecret []byte
	secureCookies bool
	adminLogin    string
}

func NewAuthService(oauth *githuboauth.OAuthClient, googleOAuth *googleoauth.OAuthClient, graphql *githuboauth.GraphQLClient, secret string, secureCookies bool, adminLogin string) *AuthService {
	return &AuthService{
		oauth:         oauth,
		googleOAuth:   googleOAuth,
		graphql:       graphql,
		signingSecret: []byte(secret),
		secureCookies: secureCookies,
		adminLogin:    strings.ToLower(strings.TrimSpace(adminLogin)),
	}
}

func (service *AuthService) NewState() string {
	return utils.NewID()
}

func (service *AuthService) LoginURL(provider string, state string, redirectURL string) string {
	if provider == "google" {
		return service.googleOAuth.AuthCodeURL(state, redirectURL)
	}
	return service.oauth.AuthCodeURL(state, redirectURL)
}

func (service *AuthService) SetOAuthStateCookie(w http.ResponseWriter, state string) {
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   service.secureCookies,
		SameSite: service.sameSiteMode(),
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

func (service *AuthService) CompleteLogin(ctx context.Context, provider string, code string, redirectURL string) (model.Session, error) {
	if provider == "google" {
		token, err := service.googleOAuth.Exchange(ctx, code, redirectURL)
		if err != nil {
			return model.Session{}, err
		}

		googleUser, err := service.googleOAuth.FetchUser(ctx, token.AccessToken)
		if err != nil {
			return model.Session{}, err
		}

		user := model.AuthUser{
			Provider:  "google",
			ID:        googleUser.Id,
			Login:     strings.Split(googleUser.Email, "@")[0],
			AvatarURL: googleUser.Picture,
		}

		return model.Session{
			AccessToken: token.AccessToken,
			User:        user,
			ExpiresAt:   time.Now().Add(7 * 24 * time.Hour),
		}, nil
	}

	token, err := service.oauth.Exchange(ctx, code, redirectURL)
	if err != nil {
		return model.Session{}, err
	}

	githubUser, err := service.graphql.FetchUser(ctx, token.AccessToken)
	if err != nil {
		return model.Session{}, err
	}

	user := model.AuthUser{
		Provider:  "github",
		ID:        fmt.Sprintf("%d", githubUser.ID),
		Login:     githubUser.Login,
		AvatarURL: githubUser.AvatarURL,
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
		SameSite: service.sameSiteMode(),
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
		SameSite: service.sameSiteMode(),
		MaxAge:   -1,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   service.secureCookies,
		SameSite: service.sameSiteMode(),
		MaxAge:   -1,
	})
}

func (service *AuthService) IsAdmin(login string) bool {
	if service.adminLogin == "" {
		return false
	}

	return strings.EqualFold(strings.TrimSpace(login), service.adminLogin)
}

func (service *AuthService) sameSiteMode() http.SameSite {
	if service.secureCookies {
		return http.SameSiteNoneMode
	}

	return http.SameSiteLaxMode
}

func (service *AuthService) sign(payload string) string {
	h := hmac.New(sha256.New, service.signingSecret)
	_, _ = h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}
