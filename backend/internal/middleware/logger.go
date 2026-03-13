package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		started := time.Now()
		c.Next()
		status := c.Writer.Status()
		// Gin accumulates errors on the context; include the last one for easier debugging.
		var lastErr string
		if len(c.Errors) > 0 {
			lastErr = c.Errors.Last().Error()
		}
		fields := []zap.Field{
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", status),
			zap.String("ip", c.ClientIP()),
			zap.Duration("duration", time.Since(started)),
		}
		if lastErr != "" {
			zap.L().Warn("request completed with error", append(fields, zap.String("error", lastErr))...)
			return
		}
		zap.L().Info("request completed", fields...)
	}
}
