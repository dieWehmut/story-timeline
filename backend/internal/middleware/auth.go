package middleware

import (
	"context"
	"net/http"

	"github.com/dieWehmut/story-timeline/backend/internal/dto"
	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
)

type contextKey string

const sessionContextKey contextKey = "session"

func RequireAuth(authService *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, err := authService.ReadSession(r)
			if err != nil {
				dto.WriteError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			ctx := context.WithValue(r.Context(), sessionContextKey, session)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireAdmin(authService *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return RequireAuth(authService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, ok := SessionFromContext(r.Context())
			if !ok {
				dto.WriteError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			if !authService.IsAdmin(session.User.Login) {
				dto.WriteError(w, http.StatusForbidden, "admin required")
				return
			}

			next.ServeHTTP(w, r)
		}))
	}
}

func SessionFromContext(ctx context.Context) (*model.Session, bool) {
	session, ok := ctx.Value(sessionContextKey).(*model.Session)
	return session, ok
}