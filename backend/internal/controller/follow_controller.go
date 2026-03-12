package controller

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/middleware"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
)

type FollowController struct {
	userService *service.UserService
}

func NewFollowController(userService *service.UserService) *FollowController {
	return &FollowController{userService: userService}
}

type followUserResponse struct {
	Login     string `json:"login"`
	AvatarURL string `json:"avatarUrl"`
}

func (controller *FollowController) Following(c *gin.Context) {
	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	users, err := controller.userService.GetFollowing(c.Request.Context(), session.User.Login)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	result := make([]followUserResponse, 0, len(users))
	for _, user := range users {
		avatar := strings.TrimSpace(user.AvatarURL)
		if avatar == "" {
			avatar = "https://github.com/" + user.Login + ".png?size=64"
		}
		result = append(result, followUserResponse{Login: user.Login, AvatarURL: avatar})
	}

	c.JSON(http.StatusOK, result)
}

func (controller *FollowController) Followers(c *gin.Context) {
	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	users, err := controller.userService.GetFollowers(c.Request.Context(), session.User.Login)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	result := make([]followUserResponse, 0, len(users))
	for _, user := range users {
		avatar := strings.TrimSpace(user.AvatarURL)
		if avatar == "" {
			avatar = "https://github.com/" + user.Login + ".png?size=64"
		}
		result = append(result, followUserResponse{Login: user.Login, AvatarURL: avatar})
	}

	c.JSON(http.StatusOK, result)
}

func (controller *FollowController) Follow(c *gin.Context) {
	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	target := strings.TrimSpace(c.Param("login"))
	if target == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing target"})
		return
	}
	if strings.EqualFold(target, session.User.Login) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot follow self"})
		return
	}

	if err := controller.userService.FollowUser(c.Request.Context(), session.User.Login, target); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (controller *FollowController) Unfollow(c *gin.Context) {
	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	target := strings.TrimSpace(c.Param("login"))
	if target == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing target"})
		return
	}
	if strings.EqualFold(target, session.User.Login) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot unfollow self"})
		return
	}

	if err := controller.userService.UnfollowUser(c.Request.Context(), session.User.Login, target); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
