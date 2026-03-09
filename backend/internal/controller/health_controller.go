package controller

import (
	"net/http"
	"sync"
	"time"

	"github.com/dieWehmut/story-timeline/backend/internal/dto"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

type HealthController struct {
	startedAt   time.Time
	githubOwner string
	secureCookies bool
	mu          sync.Mutex
	visitors    map[string]time.Time
	active      map[string]time.Time
}

func NewHealthController(githubOwner string, secureCookies bool) *HealthController {
	startedAt := time.Date(2025, 10, 10, 17, 0, 0, 0, utils.BeijingLocation())

	return &HealthController{
		startedAt:   startedAt,
		githubOwner: githubOwner,
		secureCookies: secureCookies,
		visitors:    map[string]time.Time{},
		active:      map[string]time.Time{},
	}
}

func (controller *HealthController) Stats(w http.ResponseWriter, r *http.Request) {
	controller.touchViewer(w, r)
	controller.mu.Lock()
	defer controller.mu.Unlock()
	controller.cleanupLocked()

	dto.WriteJSON(w, http.StatusOK, map[string]any{
		"visitorCount":  len(controller.visitors),
		"activeViewers": len(controller.active),
		"uptimeSeconds": int(utils.NowBeijing().Sub(controller.startedAt).Seconds()),
		"githubOwner":   fallback(controller.githubOwner, "GitHub"),
	})
}

func (controller *HealthController) Ping(w http.ResponseWriter, r *http.Request) {
	controller.touchViewer(w, r)
	dto.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (controller *HealthController) touchViewer(w http.ResponseWriter, r *http.Request) {
	controller.mu.Lock()
	defer controller.mu.Unlock()

	viewerID := ""
	if cookie, err := r.Cookie("story_viewer"); err == nil {
		viewerID = cookie.Value
	}
	if viewerID == "" {
		viewerID = utils.NewID()
		http.SetCookie(w, &http.Cookie{
			Name:     "story_viewer",
			Value:    viewerID,
			Path:     "/",
			HttpOnly: true,
			Secure:   controller.secureCookies,
			SameSite: controller.sameSiteMode(),
			MaxAge:   int((365 * 24 * time.Hour).Seconds()),
		})
	}

	now := utils.NowBeijing()
	controller.visitors[viewerID] = now
	controller.active[viewerID] = now
	controller.cleanupLocked()
}

func (controller *HealthController) cleanupLocked() {
	cutoff := utils.NowBeijing().Add(-90 * time.Second)
	for viewerID, seenAt := range controller.active {
		if seenAt.Before(cutoff) {
			delete(controller.active, viewerID)
		}
	}
}

func fallback(value string, defaultValue string) string {
	if value == "" {
		return defaultValue
	}

	return value
}

func (controller *HealthController) sameSiteMode() http.SameSite {
	if controller.secureCookies {
		return http.SameSiteNoneMode
	}

	return http.SameSiteLaxMode
}