package controller

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

const settingKeyNotification = "notification"

type notificationValue struct {
	Enabled bool   `json:"enabled"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

type NotificationController struct {
	storage *storage.SupabaseStorage
}

func NewNotificationController(store *storage.SupabaseStorage) *NotificationController {
	return &NotificationController{storage: store}
}

func (nc *NotificationController) Get(c *gin.Context) {
	raw, err := nc.storage.GetSetting(c.Request.Context(), settingKeyNotification)
	if err != nil {
		c.JSON(http.StatusOK, notificationValue{Title: "公告"})
		return
	}
	if raw == nil {
		c.JSON(http.StatusOK, notificationValue{Title: "公告"})
		return
	}
	var val notificationValue
	if err := json.Unmarshal(raw, &val); err != nil {
		c.JSON(http.StatusOK, notificationValue{Title: "公告"})
		return
	}
	if val.Title == "" {
		val.Title = "公告"
	}
	c.JSON(http.StatusOK, val)
}

func (nc *NotificationController) Update(c *gin.Context) {
	var req notificationValue
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if req.Title == "" {
		req.Title = "公告"
	}
	raw, err := json.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "marshal failed"})
		return
	}
	if err := nc.storage.UpsertSetting(c.Request.Context(), settingKeyNotification, raw); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save failed"})
		return
	}
	c.JSON(http.StatusOK, req)
}
