package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/middleware"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

const (
	uploadMaxFiles        = 15
	uploadMaxCommentFiles = 3
	uploadMaxVideos       = 3
)

type UploadController struct {
	assets *storage.CloudinaryStorage
}

func NewUploadController(assets *storage.CloudinaryStorage) *UploadController {
	return &UploadController{assets: assets}
}

type uploadItemRequest struct {
	MediaType string `json:"mediaType"`
}

type signImageUploadRequest struct {
	ImageID string              `json:"imageId"`
	Items   []uploadItemRequest `json:"items"`
}

type signCommentUploadRequest struct {
	PostOwner string              `json:"postOwner"`
	PostID    string              `json:"postId"`
	CommentID string              `json:"commentId"`
	Items     []uploadItemRequest `json:"items"`
}

type signUploadResponse struct {
	ImageID   string                  `json:"imageId,omitempty"`
	CommentID string                  `json:"commentId,omitempty"`
	Uploads   []storage.SignedUpload  `json:"uploads"`
}

func (controller *UploadController) SignImageUploads(c *gin.Context) {
	if controller.assets == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "asset storage unavailable"})
		return
	}

	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	var payload signImageUploadRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if len(payload.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing upload items"})
		return
	}
	if len(payload.Items) > uploadMaxFiles {
		c.JSON(http.StatusBadRequest, gin.H{"error": "too many files"})
		return
	}

	imageID := strings.TrimSpace(payload.ImageID)
	if imageID == "" {
		imageID = utils.NewID()
	}

	videoCount := 0
	uploads := make([]storage.SignedUpload, 0, len(payload.Items))
	for index, item := range payload.Items {
		mediaType := normalizeMediaType(item.MediaType)
		if mediaType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid media type"})
			return
		}
		if mediaType == "video" {
			videoCount++
			if videoCount > uploadMaxVideos {
				c.JSON(http.StatusBadRequest, gin.H{"error": "too many videos"})
				return
			}
		}

		publicID := imageObjectKey(session.User.Login, imageID, index)
		if mediaType == "video" {
			publicID = videoObjectKey(session.User.Login, imageID, index)
		}
		uploads = append(uploads, controller.assets.SignUpload(publicID, mediaType))
	}

	c.JSON(http.StatusOK, signUploadResponse{
		ImageID: imageID,
		Uploads: uploads,
	})
}

func (controller *UploadController) SignCommentUploads(c *gin.Context) {
	if controller.assets == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "asset storage unavailable"})
		return
	}

	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	var payload signCommentUploadRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	postOwner := strings.TrimSpace(payload.PostOwner)
	postID := strings.TrimSpace(payload.PostID)
	if postOwner == "" || postID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing post owner/id"})
		return
	}

	if len(payload.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing upload items"})
		return
	}
	if len(payload.Items) > uploadMaxCommentFiles {
		c.JSON(http.StatusBadRequest, gin.H{"error": "too many files"})
		return
	}

	commentID := strings.TrimSpace(payload.CommentID)
	if commentID == "" {
		commentID = utils.NewID()
	}

	videoCount := 0
	uploads := make([]storage.SignedUpload, 0, len(payload.Items))
	for index, item := range payload.Items {
		mediaType := normalizeMediaType(item.MediaType)
		if mediaType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid media type"})
			return
		}
		if mediaType == "video" {
			videoCount++
			if videoCount > uploadMaxVideos {
				c.JSON(http.StatusBadRequest, gin.H{"error": "too many videos"})
				return
			}
		}

		publicID := commentImagePath(session.User.Login, postOwner, postID, commentID, index)
		if mediaType == "video" {
			publicID = commentVideoPath(session.User.Login, postOwner, postID, commentID, index)
		}
		uploads = append(uploads, controller.assets.SignUpload(publicID, mediaType))
	}

	c.JSON(http.StatusOK, signUploadResponse{
		CommentID: commentID,
		Uploads:   uploads,
	})
}

func normalizeMediaType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "video":
		return "video"
	case "image":
		return "image"
	default:
		return ""
	}
}

func imageObjectKey(ownerLogin string, imageID string, assetIndex int) string {
	return "images/" + strings.TrimSpace(ownerLogin) + "/" + strings.TrimSpace(imageID) + "/" + strconv.Itoa(assetIndex)
}

func videoObjectKey(ownerLogin string, imageID string, assetIndex int) string {
	return "videos/" + strings.TrimSpace(ownerLogin) + "/" + strings.TrimSpace(imageID) + "/" + strconv.Itoa(assetIndex)
}

func commentImagePath(commenterLogin, postOwner, postID, commentID string, assetIndex int) string {
	return "comments/" + strings.TrimSpace(commenterLogin) + "/" + strings.TrimSpace(postOwner) + "/" + strings.TrimSpace(postID) + "/" + strings.TrimSpace(commentID) + "/" + strconv.Itoa(assetIndex)
}

func commentVideoPath(commenterLogin, postOwner, postID, commentID string, assetIndex int) string {
	return "comment-videos/" + strings.TrimSpace(commenterLogin) + "/" + strings.TrimSpace(postOwner) + "/" + strings.TrimSpace(postID) + "/" + strings.TrimSpace(commentID) + "/" + strconv.Itoa(assetIndex)
}
