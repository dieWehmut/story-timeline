package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
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
		if lastErr != "" {
			log.Printf("%s %s -> %d (%s) %s", c.Request.Method, c.Request.URL.Path, status, lastErr, time.Since(started).String())
			return
		}
		log.Printf("%s %s -> %d %s", c.Request.Method, c.Request.URL.Path, status, time.Since(started).String())
	}
}