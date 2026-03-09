package controller

import (
	"net/http"
	"sync"
	"time"

	"github.com/dieWehmut/story-timeline/backend/internal/dto"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

type HealthController struct {
	startedAt   time.Time
	githubOwner string
	authService *service.AuthService
	mu          sync.Mutex
	users       map[string]time.Time // login -> first seen
	online      map[string]time.Time // login -> last active
}

func NewHealthController(githubOwner string, authService *service.AuthService) *HealthController {
	startedAt := time.Date(2025, 10, 10, 17, 0, 0, 0, utils.BeijingLocation())

	return &HealthController{
		startedAt:   startedAt,
		githubOwner: githubOwner,
		authService: authService,
		users:       map[string]time.Time{},
		online:      map[string]time.Time{},
	}
}

func (controller *HealthController) Stats(w http.ResponseWriter, r *http.Request) {
	controller.touchUser(r)
	controller.mu.Lock()
	defer controller.mu.Unlock()
	controller.cleanupLocked()

	dto.WriteJSON(w, http.StatusOK, map[string]any{
		"userCount":     len(controller.users),
		"onlineUsers":   len(controller.online),
		"uptimeSeconds": int(utils.NowBeijing().Sub(controller.startedAt).Seconds()),
		"githubOwner":   fallback(controller.githubOwner, "GitHub"),
	})
}

func (controller *HealthController) Ping(w http.ResponseWriter, r *http.Request) {
	controller.touchUser(r)
	dto.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (controller *HealthController) touchUser(r *http.Request) {
	session, err := controller.authService.ReadSession(r)
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