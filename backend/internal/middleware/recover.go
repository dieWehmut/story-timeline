package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func Recover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				zap.L().Error("panic recovered", zap.Any("panic", recovered), zap.Stack("stack"))
				c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
				c.Abort()
			}
		}()

		c.Next()
	}
}
