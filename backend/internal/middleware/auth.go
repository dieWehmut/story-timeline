package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
)

const sessionKey = "session"

func RequireAuth(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		session, err := authService.ReadSession(c.Request)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			c.Abort()
			return
		}

		c.Set(sessionKey, session)
		c.Next()
	}
}

func RequireAdmin(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		session, err := authService.ReadSession(c.Request)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			c.Abort()
			return
		}

		if !authService.IsAdmin(session.User.Login) {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin required"})
			c.Abort()
			return
		}

		c.Set(sessionKey, session)
		c.Next()
	}
}

func SessionFromContext(c *gin.Context) (*model.Session, bool) {
	val, exists := c.Get(sessionKey)
	if !exists {
		return nil, false
	}
	session, ok := val.(*model.Session)
	return session, ok
}