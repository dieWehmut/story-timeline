package controller

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/dto"
	"github.com/dieWehmut/story-timeline/backend/internal/middleware"
	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

const (
	maxFiles        = 15
	maxCommentFiles = 3
	maxVideos       = 3
	maxImageFileSize  = 5 << 20  // 5 MB
	maxImageTotalSize = 25 << 20 // 25 MB (images only)
	maxVideoSize      = 200 << 20 // 200 MB
	maxTags         = 12
	maxTagLength    = 32
	assetCacheMaxAgeSeconds = 86400
)

type ImageController struct {
	imageService       *service.ImageService
	userService        *service.UserService
	authService        *service.AuthService
	interactionService *service.InteractionService
	assets             *storage.CloudinaryStorage
}

func NewImageController(imageService *service.ImageService, userService *service.UserService, authService *service.AuthService, interactionService *service.InteractionService, assets *storage.CloudinaryStorage) *ImageController {
	return &ImageController{
		imageService:       imageService,
		userService:        userService,
		authService:        authService,
		interactionService: interactionService,
		assets:             assets,
	}
}

func assetTypeFromPath(path string) string {
	trimmed := strings.ToLower(strings.TrimSpace(path))
	if strings.HasPrefix(trimmed, "videos/") || strings.HasPrefix(trimmed, "comment-videos/") || strings.Contains(trimmed, "/video/upload/") {
		return "video"
	}
	return "image"
}

func (controller *ImageController) assetURLs(paths []string) ([]string, []string) {
	urls := make([]string, 0, len(paths))
	assetTypes := make([]string, 0, len(paths))
	for _, path := range paths {
		resolved := strings.TrimSpace(path)
		if resolved == "" {
			continue
		}
		assetTypes = append(assetTypes, assetTypeFromPath(resolved))
		if controller.assets != nil {
			resolved = controller.assets.URLFor(resolved)
		}
		urls = append(urls, resolved)
	}
	return urls, assetTypes
}

func (controller *ImageController) commentAssetURLs(comment model.Comment) ([]string, []string) {
	return controller.assetURLs(comment.AllImagePaths())
}

func setAssetCacheHeaders(c *gin.Context) {
	c.Header("Cache-Control", fmt.Sprintf("public, max-age=%d", assetCacheMaxAgeSeconds))
	c.Header("Vary", "Accept-Encoding")
	c.Header("Accept-Ranges", "bytes")
}

func parseImageTimes(c *gin.Context) (string, time.Time, time.Time, error) {
	timeMode := c.Request.FormValue("timeMode")
	if timeMode == "" {
		timeMode = model.ImageTimeModePoint
	}

	startValue := c.Request.FormValue("startAt")
	if startValue == "" {
		startValue = c.Request.FormValue("capturedAt")
	}

	startAt, err := utils.ParseBeijing(startValue)
	if err != nil {
		return "", time.Time{}, time.Time{}, err
	}

	if timeMode != model.ImageTimeModeRange {
		return model.ImageTimeModePoint, startAt, time.Time{}, nil
	}

	endAt, err := utils.ParseBeijing(c.Request.FormValue("endAt"))
	if err != nil {
		return "", time.Time{}, time.Time{}, err
	}
	if endAt.Before(startAt) {
		return "", time.Time{}, time.Time{}, fmt.Errorf("end before start")
	}

	return model.ImageTimeModeRange, startAt, endAt, nil
}

func parseTags(c *gin.Context) ([]string, error) {
	rawTags := c.Request.Form["tags"]
	if len(rawTags) == 0 {
		if csvValue := c.Request.FormValue("tags"); csvValue != "" {
			rawTags = strings.Split(csvValue, ",")
		}
	}

	seen := map[string]struct{}{}
	tags := make([]string, 0, len(rawTags))
	for _, rawTag := range rawTags {
		for _, part := range strings.Split(rawTag, ",") {
			tag := strings.TrimSpace(part)
			if tag == "" {
				continue
			}
			if len([]rune(tag)) > maxTagLength {
				return nil, fmt.Errorf("tag too long")
			}
			key := strings.ToLower(tag)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			tags = append(tags, tag)
			if len(tags) > maxTags {
				return nil, fmt.Errorf("too many tags")
			}
		}
	}

	return tags, nil
}

// Feed returns the aggregated feed for the current user.
func (controller *ImageController) Feed(c *gin.Context) {
	var feedLogins []string
	var viewerLogin string

	session, _ := controller.authService.ReadSession(c.Request)
	if session != nil {
		viewerLogin = session.User.Login
		feedUsers, err := controller.userService.GetFeedUsers(c.Request.Context(), session.AccessToken, session.User.Login)
		if err == nil {
			for _, u := range feedUsers {
				feedLogins = append(feedLogins, u.Login)
			}
		}
		// Include viewer's own posts
		feedLogins = append(feedLogins, session.User.Login)
	}

	// All feed logins + admin for comment aggregation
	allLogins := feedLogins
	adminLogin := controller.userService.AdminLogin()
	hasAdmin := false
	for _, l := range allLogins {
		if strings.EqualFold(l, adminLogin) {
			hasAdmin = true
			break
		}
	}
	if !hasAdmin && adminLogin != "" {
		allLogins = append(allLogins, adminLogin)
	}

	items := controller.imageService.GetFeed(c.Request.Context(), tokenFromSession(session), feedLogins)
	response := make([]dto.ImageResponse, 0, len(items))
	if len(items) == 0 {
		c.JSON(http.StatusOK, response)
		return
	}

	postOwners := make([]string, 0, len(items))
	postIDs := make([]string, 0, len(items))
	ownerSeen := map[string]struct{}{}
	idSeen := map[string]struct{}{}
	validKeys := map[string]struct{}{}

	for _, item := range items {
		ownerLogin := item.AuthorLogin
		if ownerLogin == "" {
			ownerLogin = adminLogin
		}
		key := strings.ToLower(ownerLogin) + "|" + item.ID
		validKeys[key] = struct{}{}

		if _, ok := ownerSeen[strings.ToLower(ownerLogin)]; !ok {
			ownerSeen[strings.ToLower(ownerLogin)] = struct{}{}
			postOwners = append(postOwners, ownerLogin)
		}
		if _, ok := idSeen[item.ID]; !ok {
			idSeen[item.ID] = struct{}{}
			postIDs = append(postIDs, item.ID)
		}
	}

	likeCounts := map[string]int{}
	likedByViewer := map[string]bool{}
	for _, like := range controller.interactionService.GetLikesByPosts(c.Request.Context(), postOwners, postIDs) {
		key := strings.ToLower(like.PostOwner) + "|" + like.PostID
		if _, ok := validKeys[key]; !ok {
			continue
		}
		likeCounts[key] += 1
		if viewerLogin != "" && strings.EqualFold(like.Login, viewerLogin) {
			likedByViewer[key] = true
		}
	}

	commentCounts := map[string]int{}
	for _, comment := range controller.interactionService.GetCommentsByPosts(c.Request.Context(), postOwners, postIDs, allLogins) {
		key := strings.ToLower(comment.PostOwner) + "|" + comment.PostID
		if _, ok := validKeys[key]; !ok {
			continue
		}
		commentCounts[key] += 1
	}

	for _, item := range items {
		ownerLogin := item.AuthorLogin
		if ownerLogin == "" {
			ownerLogin = adminLogin
		}
		key := strings.ToLower(ownerLogin) + "|" + item.ID
		assetURLs, assetTypes := controller.assetURLs(item.AllImagePaths())
		resp := dto.NewImageResponse(item, assetURLs, assetTypes)
		resp.LikeCount = likeCounts[key]
		resp.CommentCount = commentCounts[key]
		if viewerLogin != "" {
			resp.Liked = likedByViewer[key]
		}

		response = append(response, resp)
	}

	c.JSON(http.StatusOK, response)
}

// FeedUsers returns the list of users visible in the feed.
func (controller *ImageController) FeedUsers(c *gin.Context) {
	adminLogin := controller.userService.AdminLogin()

	// Always include admin
	var users []model.GitHubUser

	session, _ := controller.authService.ReadSession(c.Request)
	if session != nil {
		feedUsers, err := controller.userService.GetFeedUsers(c.Request.Context(), session.AccessToken, session.User.Login)
		if err == nil {
			users = append(users, feedUsers...)
		}
		// Include viewer if authenticated
		users = append(users, session.User)
	}

	// Ensure admin is in the list
	hasAdmin := false
	for _, u := range users {
		if strings.EqualFold(u.Login, adminLogin) {
			hasAdmin = true
			break
		}
	}
	if !hasAdmin && adminLogin != "" {
		users = append([]model.GitHubUser{{Login: adminLogin, AvatarURL: fmt.Sprintf("https://github.com/%s.png?size=64", adminLogin)}}, users...)
	}

	// Deduplicate
	seen := map[string]struct{}{}
	var unique []model.GitHubUser
	for _, u := range users {
		lower := strings.ToLower(u.Login)
		if _, ok := seen[lower]; ok {
			continue
		}
		seen[lower] = struct{}{}
		unique = append(unique, u)
	}

	type userResponse struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatarUrl"`
	}

	result := make([]userResponse, 0, len(unique))
	for _, u := range unique {
		avatar := u.AvatarURL
		if avatar == "" {
			avatar = fmt.Sprintf("https://github.com/%s.png?size=64", u.Login)
		}
		result = append(result, userResponse{Login: u.Login, AvatarURL: avatar})
	}

	c.JSON(http.StatusOK, result)
}

func (controller *ImageController) Create(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(maxImageTotalSize + (1 << 20)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	files, err := readMultipartFiles(c.Request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tags, err := parseTags(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tags"})
		return
	}

	timeMode, startAt, endAt, err := parseImageTimes(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid time fields"})
		return
	}

	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	image, err := controller.imageService.Create(c.Request.Context(), session.AccessToken, session.User, c.Request.FormValue("description"), tags, timeMode, startAt, endAt, files)
	if err != nil {
		_ = c.Error(err)
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	assetURLs, assetTypes := controller.assetURLs(image.AllImagePaths())
	c.JSON(http.StatusCreated, dto.NewImageResponse(image, assetURLs, assetTypes))
}

func (controller *ImageController) Update(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(maxImageTotalSize + (1 << 20)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	imageID := c.Param("imageID")
	timeMode, startAt, endAt, err := parseImageTimes(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid time fields"})
		return
	}

	files, err := readMultipartFiles(c.Request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tags, err := parseTags(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tags"})
		return
	}

	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	// Users can only edit their own posts
	ownerLogin := session.User.Login
	image, err := controller.imageService.Update(c.Request.Context(), session.AccessToken, ownerLogin, imageID, c.Request.FormValue("description"), tags, timeMode, startAt, endAt, files)
	if err != nil {
		_ = c.Error(err)
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	assetURLs, assetTypes := controller.assetURLs(image.AllImagePaths())
	c.JSON(http.StatusOK, dto.NewImageResponse(image, assetURLs, assetTypes))
}

func (controller *ImageController) Delete(c *gin.Context) {
	imageID := c.Param("imageID")
	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	// Users can only delete their own posts
	ownerLogin := session.User.Login
	if err := controller.imageService.Delete(c.Request.Context(), session.AccessToken, ownerLogin, imageID); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (controller *ImageController) Asset(c *gin.Context) {
	ownerLogin := c.Param("ownerLogin")
	imageID := c.Param("imageID")
	assetIndex, err := strconv.Atoi(c.Param("assetIndex"))
	if err != nil || assetIndex < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset index"})
		return
	}

	// Redirect to Cloudinary so the browser/CDN can handle caching + range requests (video playback).
	if controller.assets != nil {
		url, urlErr := controller.imageService.AssetURL(c.Request.Context(), ownerLogin, imageID, assetIndex)
		if urlErr == nil && strings.TrimSpace(url) != "" {
			setAssetCacheHeaders(c)
			c.Redirect(http.StatusTemporaryRedirect, url)
			return
		}
	}

	content, contentType, err := controller.imageService.ReadAsset(c.Request.Context(), "", ownerLogin, imageID, assetIndex)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	setAssetCacheHeaders(c)
	c.Header("Content-Type", contentType)
	http.ServeContent(c.Writer, c.Request, "", time.Time{}, bytes.NewReader(content))
}

func tokenFromSession(session *model.Session) string {
	if session != nil {
		return session.AccessToken
	}
	return ""
}

// ToggleLike toggles a like on a post.
func (controller *ImageController) ToggleLike(c *gin.Context) {
	ownerLogin := c.Param("ownerLogin")
	postID := c.Param("imageID")

	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	lf, err := controller.interactionService.ToggleLike(c.Request.Context(), session.AccessToken, ownerLogin, postID, session.User)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	liked := false
	for _, l := range lf.Likes {
		if strings.EqualFold(l.Login, session.User.Login) {
			liked = true
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"likeCount": len(lf.Likes),
		"liked":     liked,
	})
}

// ToggleCommentLike toggles a like on a comment.
func (controller *ImageController) ToggleCommentLike(c *gin.Context) {
	ownerLogin := c.Param("ownerLogin")
	postID := c.Param("imageID")
	commentID := c.Param("commentID")

	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	likeCount, liked, err := controller.interactionService.ToggleCommentLike(c.Request.Context(), ownerLogin, postID, commentID, session.User)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"likeCount": likeCount,
		"liked":     liked,
	})
}

// GetComments returns comments for a post.
func (controller *ImageController) GetComments(c *gin.Context) {
	ownerLogin := c.Param("ownerLogin")
	postID := c.Param("imageID")

	var feedLogins []string
	session, _ := controller.authService.ReadSession(c.Request)
	if session != nil {
		feedUsers, err := controller.userService.GetFeedUsers(c.Request.Context(), session.AccessToken, session.User.Login)
		if err == nil {
			for _, u := range feedUsers {
				feedLogins = append(feedLogins, u.Login)
			}
		}
		feedLogins = append(feedLogins, session.User.Login)
	}

	adminLogin := controller.userService.AdminLogin()
	hasAdmin := false
	for _, l := range feedLogins {
		if strings.EqualFold(l, adminLogin) {
			hasAdmin = true
			break
		}
	}
	if !hasAdmin && adminLogin != "" {
		feedLogins = append(feedLogins, adminLogin)
	}

	comments := controller.interactionService.GetAllComments(c.Request.Context(), tokenFromSession(session), ownerLogin, postID, feedLogins)
	currentLogin := ""
	if session != nil {
		currentLogin = session.User.Login
	}
	commentLikes := controller.interactionService.GetCommentLikesByPost(c.Request.Context(), ownerLogin, postID)
	likeCounts := make(map[string]int)
	likedBy := make(map[string]bool)
	for _, like := range commentLikes {
		likeCounts[like.CommentID] += 1
		if currentLogin != "" && strings.EqualFold(like.Login, currentLogin) {
			likedBy[like.CommentID] = true
		}
	}
	result := make([]dto.CommentResponse, 0, len(comments))
	for _, cm := range comments {
		var imageUrl string
		imageURLs, assetTypes := controller.commentAssetURLs(cm.Comment)
		if len(imageURLs) > 0 {
			imageUrl = imageURLs[0]
		}
		result = append(result, dto.CommentResponse{
			ID:          cm.ID,
			AuthorLogin: cm.AuthorLogin,
			PostOwner:   cm.PostOwner,
			PostID:      cm.PostID,
			Text:        cm.Text,
			ImageUrl:    imageUrl,
			ImageURLs:   imageURLs,
			AssetTypes:  assetTypes,
			CreatedAt:   cm.CreatedAt.Format("2006-01-02T15:04:05-07:00"),
			LikeCount:   likeCounts[cm.ID],
			Liked:       likedBy[cm.ID],
			ParentID:    cm.ParentID,
			ReplyToUserLogin: cm.ReplyToUserLogin,
		})
	}

	c.JSON(http.StatusOK, result)
}

// AddComment adds a comment on a post. The comment is stored in the commenter's repo.
func (controller *ImageController) AddComment(c *gin.Context) {
	ownerLogin := c.Param("ownerLogin")
	postID := c.Param("imageID")

	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	var text string
	var parentID string
	var replyToUserLogin string
	var files []*multipart.FileHeader

	contentType := c.GetHeader("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := c.Request.ParseMultipartForm(maxImageTotalSize + (1 << 20)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		text = strings.TrimSpace(c.PostForm("text"))
		parentID = strings.TrimSpace(c.PostForm("parentId"))
		replyToUserLogin = strings.TrimSpace(c.PostForm("replyToUserLogin"))
		selectedFiles, err := readMultipartFilesWithLimit(c.Request, maxCommentFiles)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		files = selectedFiles
	} else {
		var body struct {
			Text             string `json:"text"`
			ParentID         string `json:"parentId"`
			ReplyToUserLogin string `json:"replyToUserLogin"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请输入评论内容"})
			return
		}
		text = strings.TrimSpace(body.Text)
		parentID = strings.TrimSpace(body.ParentID)
		replyToUserLogin = strings.TrimSpace(body.ReplyToUserLogin)
	}

	if text == "" && len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入评论内容或选择图片/视频"})
		return
	}

	comment, err := controller.interactionService.AddComment(c.Request.Context(), session.AccessToken, session.User, ownerLogin, postID, text, files, parentID, replyToUserLogin)
	if err != nil {
		_ = c.Error(err)
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	var imageUrl string
	imageURLs, assetTypes := controller.commentAssetURLs(comment)
	if len(imageURLs) > 0 {
		imageUrl = imageURLs[0]
	}

	c.JSON(http.StatusCreated, dto.CommentResponse{
		ID:          comment.ID,
		AuthorLogin: session.User.Login,
		PostOwner:   comment.PostOwner,
		PostID:      comment.PostID,
		Text:        comment.Text,
		ImageUrl:    imageUrl,
		ImageURLs:   imageURLs,
		AssetTypes:  assetTypes,
		CreatedAt:   comment.CreatedAt.Format("2006-01-02T15:04:05-07:00"),
		LikeCount:   0,
		Liked:       false,
		ParentID:    comment.ParentID,
		ReplyToUserLogin: comment.ReplyToUserLogin,
	})
}

// DeleteComment deletes (hides) a comment. Allowed for comment author or post owner.
func (controller *ImageController) DeleteComment(c *gin.Context) {
	ownerLogin := c.Param("ownerLogin")
	postID := c.Param("imageID")
	commentID := c.Param("commentID")

	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	// Determine the commenter login: try query param, fall back to caller
	commenterLogin := c.Query("commenter")
	if commenterLogin == "" {
		commenterLogin = session.User.Login
	}

	if err := controller.interactionService.DeleteComment(
		c.Request.Context(), session.AccessToken, session.User,
		commenterLogin, ownerLogin, postID, commentID,
	); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// CommentAsset serves a comment image.
func (controller *ImageController) CommentAsset(c *gin.Context) {
	commenterLogin := c.Param("commenterLogin")
	postOwner := c.Param("postOwner")
	postID := c.Param("postID")
	commentID := c.Param("commentID")
	assetIndex := 0
	if rawAssetIndex := c.Param("assetIndex"); rawAssetIndex != "" {
		parsedIndex, err := strconv.Atoi(rawAssetIndex)
		if err != nil || parsedIndex < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset index"})
			return
		}
		assetIndex = parsedIndex
	}

	// Redirect to Cloudinary for caching + range requests.
	if controller.assets != nil {
		url, urlErr := controller.interactionService.CommentAssetURL(c.Request.Context(), commenterLogin, postOwner, postID, commentID, assetIndex)
		if urlErr == nil && strings.TrimSpace(url) != "" {
			setAssetCacheHeaders(c)
			c.Redirect(http.StatusTemporaryRedirect, url)
			return
		}
	}

	content, contentType, err := controller.interactionService.ReadCommentImage(c.Request.Context(), commenterLogin, postOwner, postID, commentID, assetIndex)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	setAssetCacheHeaders(c)
	c.Header("Content-Type", contentType)
	http.ServeContent(c.Writer, c.Request, "", time.Time{}, bytes.NewReader(content))
}

func readMultipartFiles(r *http.Request) ([]*multipart.FileHeader, error) {
	return readMultipartFilesWithLimit(r, maxFiles)
}

func readMultipartFilesWithLimit(r *http.Request, maxCount int) ([]*multipart.FileHeader, error) {
	fileHeaders := r.MultipartForm.File["files"]
	if len(fileHeaders) == 0 {
		fileHeaders = r.MultipartForm.File["file"]
	}
	if len(fileHeaders) > maxCount {
		return nil, fmt.Errorf("最多上传 %d 个文件", maxCount)
	}

	videoCount := 0
	var imageTotalSize int64
	for _, fh := range fileHeaders {
		if isVideoFileHeader(fh) {
			videoCount += 1
			if videoCount > maxVideos {
				return nil, fmt.Errorf("最多上传 %d 个视频", maxVideos)
			}
			if fh.Size > maxVideoSize {
				return nil, fmt.Errorf("单个视频不能超过 200MB: %s", fh.Filename)
			}
			continue
		}

		if fh.Size > maxImageFileSize {
			return nil, fmt.Errorf("单张图片不能超过 5MB: %s", fh.Filename)
		}
		imageTotalSize += fh.Size
		if imageTotalSize > maxImageTotalSize {
			return nil, fmt.Errorf("图片总大小不能超过 25MB")
		}
	}

	return fileHeaders, nil
}

func isVideoFileHeader(fh *multipart.FileHeader) bool {
	contentType := strings.ToLower(strings.TrimSpace(fh.Header.Get("Content-Type")))
	if strings.HasPrefix(contentType, "video/") {
		return true
	}
	if strings.HasPrefix(contentType, "image/") {
		return false
	}

	switch strings.ToLower(filepath.Ext(fh.Filename)) {
	case ".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv":
		return true
	}

	return false
}
