package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/dieWehmut/story-timeline/backend/internal/dto"
	"github.com/dieWehmut/story-timeline/backend/internal/middleware"
	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

const (
	maxFiles     = 9
	maxCommentFiles = 3
	maxFileSize  = 5 << 20  // 5 MB
	maxTotalSize = 25 << 20 // 25 MB
)

type ImageController struct {
	imageService       *service.ImageService
	userService        *service.UserService
	authService        *service.AuthService
	interactionService *service.InteractionService
}

func NewImageController(imageService *service.ImageService, userService *service.UserService, authService *service.AuthService, interactionService *service.InteractionService) *ImageController {
	return &ImageController{
		imageService:       imageService,
		userService:        userService,
		authService:        authService,
		interactionService: interactionService,
	}
}

func assetURLs(ownerLogin string, id string, count int) []string {
	urls := make([]string, count)
	for i := range count {
		urls[i] = fmt.Sprintf("/api/images/%s/%s/asset/%d", ownerLogin, id, i)
	}
	return urls
}

func commentAssetURLs(commenterLogin string, comment model.Comment, count int) []string {
	urls := make([]string, count)
	for i := range count {
		urls[i] = fmt.Sprintf("/api/comments/%s/%s/%s/%s/asset/%d", commenterLogin, comment.PostOwner, comment.PostID, comment.ID, i)
	}
	return urls
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
	for _, item := range items {
		ownerLogin := item.AuthorLogin
		if ownerLogin == "" {
			ownerLogin = adminLogin
		}
		resp := dto.NewImageResponse(item, assetURLs(ownerLogin, item.ID, len(item.AllImagePaths())))

		likeCount, commentCount := controller.interactionService.GetPostInteractionCounts(
			c.Request.Context(), tokenFromSession(session), ownerLogin, item.ID, allLogins,
		)
		resp.LikeCount = likeCount
		resp.CommentCount = commentCount
		if viewerLogin != "" {
			resp.Liked = controller.interactionService.IsLikedBy(
				c.Request.Context(), tokenFromSession(session), ownerLogin, item.ID, viewerLogin,
			)
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
	if err := c.Request.ParseMultipartForm(maxTotalSize + (1 << 20)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	files, err := readMultipartFiles(c.Request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	// Ensure user has a story-timeline-data repository
	if err := controller.userService.EnsureRepo(c.Request.Context(), session.AccessToken, session.User.Login); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("无法创建数据仓库: %s", err.Error())})
		return
	}

	image, err := controller.imageService.Create(c.Request.Context(), session.AccessToken, session.User, c.Request.FormValue("description"), timeMode, startAt, endAt, files)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, dto.NewImageResponse(image, assetURLs(session.User.Login, image.ID, len(image.AllImagePaths()))))
}

func (controller *ImageController) Update(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(maxTotalSize + (1 << 20)); err != nil {
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

	session, ok := middleware.SessionFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing session"})
		return
	}

	// Users can only edit their own posts
	ownerLogin := session.User.Login
	image, err := controller.imageService.Update(c.Request.Context(), session.AccessToken, ownerLogin, imageID, c.Request.FormValue("description"), timeMode, startAt, endAt, files)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.NewImageResponse(image, assetURLs(ownerLogin, image.ID, len(image.AllImagePaths()))))
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

	content, contentType, err := controller.imageService.ReadAsset(c.Request.Context(), "", ownerLogin, imageID, assetIndex)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, contentType, content)
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
	result := make([]dto.CommentResponse, 0, len(comments))
	for _, cm := range comments {
		var imageUrl string
		imageURLs := commentAssetURLs(cm.AuthorLogin, cm.Comment, len(cm.AllImagePaths()))
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
			CreatedAt:   cm.CreatedAt.Format("2006-01-02T15:04:05-07:00"),
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

	// Ensure commenter has a repo
	if err := controller.userService.EnsureRepo(c.Request.Context(), session.AccessToken, session.User.Login); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("无法创建数据仓库: %s", err.Error())})
		return
	}

	var text string
	var imageData [][]byte

	contentType := c.GetHeader("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := c.Request.ParseMultipartForm(maxTotalSize + (1 << 20)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		text = strings.TrimSpace(c.PostForm("text"))
		files, err := readMultipartFilesWithLimit(c.Request, maxCommentFiles)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		imageData = files
	} else {
		var body struct {
			Text string `json:"text"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请输入评论内容"})
			return
		}
		text = strings.TrimSpace(body.Text)
	}

	if text == "" && len(imageData) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入评论内容或选择图片"})
		return
	}

	comment, err := controller.interactionService.AddComment(c.Request.Context(), session.AccessToken, session.User, ownerLogin, postID, text, imageData)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	var imageUrl string
	imageURLs := commentAssetURLs(session.User.Login, comment, len(comment.AllImagePaths()))
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
		CreatedAt:   comment.CreatedAt.Format("2006-01-02T15:04:05-07:00"),
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

	content, contentType, err := controller.interactionService.ReadCommentImage(c.Request.Context(), commenterLogin, postOwner, postID, commentID, assetIndex)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, contentType, content)
}

func readMultipartFiles(r *http.Request) ([][]byte, error) {
	return readMultipartFilesWithLimit(r, maxFiles)
}

func readMultipartFilesWithLimit(r *http.Request, maxCount int) ([][]byte, error) {
	fileHeaders := r.MultipartForm.File["files"]
	if len(fileHeaders) == 0 {
		fileHeaders = r.MultipartForm.File["file"]
	}
	if len(fileHeaders) > maxCount {
		return nil, fmt.Errorf("最多上传 %d 张图片", maxCount)
	}

	var totalSize int64
	var result [][]byte
	for _, fh := range fileHeaders {
		if fh.Size > maxFileSize {
			return nil, fmt.Errorf("单张图片不能超过 5MB: %s", fh.Filename)
		}
		totalSize += fh.Size
		if totalSize > maxTotalSize {
			return nil, fmt.Errorf("帖子总大小不能超过 25MB")
		}

		f, err := fh.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(f)
		f.Close()
		if err != nil {
			return nil, err
		}
		result = append(result, data)
	}

	return result, nil
}