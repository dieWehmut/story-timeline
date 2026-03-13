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

	"github.com/golang-jwt/jwt/v5"

	githuboauth "github.com/dieWehmut/story-timeline/backend/internal/github"
	googleoauth "github.com/dieWehmut/story-timeline/backend/internal/google"
	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

const (
	sessionCookieName = "story_session"
	stateCookieName   = "story_oauth_state"
	defaultSessionTTL = 7 * 24 * time.Hour
)

type AuthService struct {
	oauth         *githuboauth.OAuthClient
	googleOAuth   *googleoauth.OAuthClient
	graphql       *githuboauth.GraphQLClient
	signingSecret []byte
	secureCookies bool
	adminLogin    string
}

type sessionClaims struct {
	User        model.AuthUser `json:"user"`
	AccessToken string         `json:"accessToken"`
	jwt.RegisteredClaims
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
	expiresAt := session.ExpiresAt
	if expiresAt.IsZero() {
		expiresAt = time.Now().Add(defaultSessionTTL)
	}

	claims := sessionClaims{
		User:        session.User,
		AccessToken: session.AccessToken,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   session.User.Login,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(service.signingSecret)
	if err != nil {
		return err
	}

	maxAge := int(time.Until(expiresAt).Seconds())
	if maxAge < 0 {
		maxAge = 0
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    signed,
		Path:     "/",
		HttpOnly: true,
		Secure:   service.secureCookies,
		SameSite: service.sameSiteMode(),
		MaxAge:   maxAge,
	})

	return nil
}

func (service *AuthService) ReadSession(r *http.Request) (*model.Session, error) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return nil, err
	}

	if strings.Count(cookie.Value, ".") == 2 {
		return service.readJWTSession(cookie.Value)
	}

	return service.readLegacySession(cookie.Value)
}

func (service *AuthService) readJWTSession(value string) (*model.Session, error) {
	claims := &sessionClaims{}
	token, err := jwt.ParseWithClaims(value, claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return service.signingSecret, nil
	})
	if err != nil {
		return nil, err
	}
	if token == nil || !token.Valid {
		return nil, errors.New("invalid session token")
	}
	if claims.ExpiresAt == nil || claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, errors.New("session expired")
	}

	return &model.Session{
		AccessToken: claims.AccessToken,
		User:        claims.User,
		ExpiresAt:   claims.ExpiresAt.Time,
	}, nil
}

func (service *AuthService) readLegacySession(value string) (*model.Session, error) {
	parts := strings.Split(value, ".")
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
