package middleware

import (
	"context"
	"net/http"

	"story-backend/internal/dto"
	"story-backend/internal/model"
	"story-backend/internal/service"
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

func SessionFromContext(ctx context.Context) (*model.Session, bool) {
	session, ok := ctx.Value(sessionContextKey).(*model.Session)
	return session, ok
}