package controller

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/service"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

type HealthController struct {
	startedAt   time.Time
	githubOwner string
	authService *service.AuthService
	userService *service.UserService
	mu          sync.Mutex
	users       map[string]time.Time // login -> first seen
	online      map[string]time.Time // login -> last active
}

func NewHealthController(githubOwner string, authService *service.AuthService, userService *service.UserService) *HealthController {
	startedAt := time.Date(2025, 10, 10, 17, 0, 0, 0, utils.BeijingLocation())

	return &HealthController{
		startedAt:   startedAt,
		githubOwner: githubOwner,
		authService: authService,
		userService: userService,
		users:       map[string]time.Time{},
		online:      map[string]time.Time{},
	}
}

func (controller *HealthController) Stats(c *gin.Context) {
	controller.touchUser(c)
	userCount := 0
	userCountOK := false
	if controller.userService != nil {
		if count, err := controller.userService.CountUsers(c.Request.Context()); err == nil {
			userCount = count
			userCountOK = true
		}
	}
	controller.mu.Lock()
	defer controller.mu.Unlock()
	controller.cleanupLocked()
	if !userCountOK {
		userCount = len(controller.users)
	}

	c.JSON(http.StatusOK, gin.H{
		"userCount":     userCount,
		"onlineUsers":   len(controller.online),
		"uptimeSeconds": int(utils.NowBeijing().Sub(controller.startedAt).Seconds()),
		"githubOwner":   fallback(controller.githubOwner, "GitHub"),
	})
}

func (controller *HealthController) Ping(c *gin.Context) {
	controller.touchUser(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (controller *HealthController) touchUser(c *gin.Context) {
	session, err := controller.authService.ReadSession(c.Request)
	if err != nil || session == nil {
		return
	}

	login := session.User.Login
	if login == "" {
		return
	}

	controller.mu.Lock()
	defer controller.mu.Unlock()

	now := utils.NowBeijing()
	if _, exists := controller.users[login]; !exists {
		controller.users[login] = now
	}
	controller.online[login] = now
	controller.cleanupLocked()
}

func (controller *HealthController) cleanupLocked() {
	cutoff := utils.NowBeijing().Add(-90 * time.Second)
	for login, seenAt := range controller.online {
		if seenAt.Before(cutoff) {
			delete(controller.online, login)
		}
	}
}

func fallback(value string, defaultValue string) string {
	if value == "" {
		return defaultValue
	}

	return value
}
