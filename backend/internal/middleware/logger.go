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
		log.Printf("%s %s %s", c.Request.Method, c.Request.URL.Path, time.Since(started).String())
	}
}