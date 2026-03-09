package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/dieWehmut/story-timeline/backend/internal/dto"
	"github.com/dieWehmut/story-timeline/backend/internal/middleware"
	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/service"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

const (
	maxFiles     = 9
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

// Feed returns the aggregated feed for the current user.
func (controller *ImageController) Feed(w http.ResponseWriter, r *http.Request) {
	var feedLogins []string
	var viewerLogin string

	session, _ := controller.authService.ReadSession(r)
	if session != nil {
		viewerLogin = session.User.Login
		feedUsers, err := controller.userService.GetFeedUsers(r.Context(), session.AccessToken, session.User.Login)
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

	items := controller.imageService.GetFeed(r.Context(), tokenFromSession(session), feedLogins)
	response := make([]dto.ImageResponse, 0, len(items))
	for _, item := range items {
		ownerLogin := item.AuthorLogin
		if ownerLogin == "" {
			ownerLogin = adminLogin
		}
		resp := dto.NewImageResponse(item, assetURLs(ownerLogin, item.ID, len(item.AllImagePaths())))

		likeCount, commentCount := controller.interactionService.GetPostInteractionCounts(
			r.Context(), tokenFromSession(session), ownerLogin, item.ID, allLogins,
		)
		resp.LikeCount = likeCount
		resp.CommentCount = commentCount
		if viewerLogin != "" {
			resp.Liked = controller.interactionService.IsLikedBy(
				r.Context(), tokenFromSession(session), ownerLogin, item.ID, viewerLogin,
			)
		}

		response = append(response, resp)
	}

	dto.WriteJSON(w, http.StatusOK, response)
}

// FeedUsers returns the list of users visible in the feed.
func (controller *ImageController) FeedUsers(w http.ResponseWriter, r *http.Request) {
	adminLogin := controller.userService.AdminLogin()

	// Always include admin
	var users []model.GitHubUser

	session, _ := controller.authService.ReadSession(r)
	if session != nil {
		feedUsers, err := controller.userService.GetFeedUsers(r.Context(), session.AccessToken, session.User.Login)
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

	dto.WriteJSON(w, http.StatusOK, result)
}

func (controller *ImageController) Create(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxTotalSize + (1 << 20)); err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	files, err := readMultipartFiles(r)
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	capturedAt, err := utils.ParseBeijing(r.FormValue("capturedAt"))
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, "invalid capturedAt")
		return
	}

	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		dto.WriteError(w, http.StatusUnauthorized, "missing session")
		return
	}

	// Ensure user has a story-timeline-data repository
	if err := controller.userService.EnsureRepo(r.Context(), session.AccessToken, session.User.Login); err != nil {
		dto.WriteError(w, http.StatusBadGateway, fmt.Sprintf("无法创建数据仓库: %s", err.Error()))
		return
	}

	image, err := controller.imageService.Create(r.Context(), session.AccessToken, session.User, r.FormValue("description"), capturedAt, files)
	if err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	dto.WriteJSON(w, http.StatusCreated, dto.NewImageResponse(image, assetURLs(session.User.Login, image.ID, len(image.AllImagePaths()))))
}

func (controller *ImageController) Update(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxTotalSize + (1 << 20)); err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	imageID := chi.URLParam(r, "imageID")
	capturedAt, err := utils.ParseBeijing(r.FormValue("capturedAt"))
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, "invalid capturedAt")
		return
	}

	files, err := readMultipartFiles(r)
	if err != nil {
		dto.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		dto.WriteError(w, http.StatusUnauthorized, "missing session")
		return
	}

	// Users can only edit their own posts
	ownerLogin := session.User.Login
	image, err := controller.imageService.Update(r.Context(), session.AccessToken, ownerLogin, imageID, r.FormValue("description"), capturedAt, files)
	if err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	dto.WriteJSON(w, http.StatusOK, dto.NewImageResponse(image, assetURLs(ownerLogin, image.ID, len(image.AllImagePaths()))))
}

func (controller *ImageController) Delete(w http.ResponseWriter, r *http.Request) {
	imageID := chi.URLParam(r, "imageID")
	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		dto.WriteError(w, http.StatusUnauthorized, "missing session")
		return
	}

	// Users can only delete their own posts
	ownerLogin := session.User.Login
	if err := controller.imageService.Delete(r.Context(), session.AccessToken, ownerLogin, imageID); err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	dto.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (controller *ImageController) Asset(w http.ResponseWriter, r *http.Request) {
	ownerLogin := chi.URLParam(r, "ownerLogin")
	imageID := chi.URLParam(r, "imageID")
	assetIndex, err := strconv.Atoi(chi.URLParam(r, "assetIndex"))
	if err != nil || assetIndex < 0 {
		dto.WriteError(w, http.StatusBadRequest, "invalid asset index")
		return
	}

	content, contentType, err := controller.imageService.ReadAsset(r.Context(), "", ownerLogin, imageID, assetIndex)
	if err != nil {
		dto.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
}

func tokenFromSession(session *model.Session) string {
	if session != nil {
		return session.AccessToken
	}
	return ""
}

// ToggleLike toggles a like on a post.
func (controller *ImageController) ToggleLike(w http.ResponseWriter, r *http.Request) {
	ownerLogin := chi.URLParam(r, "ownerLogin")
	postID := chi.URLParam(r, "postID")

	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		dto.WriteError(w, http.StatusUnauthorized, "missing session")
		return
	}

	lf, err := controller.interactionService.ToggleLike(r.Context(), session.AccessToken, ownerLogin, postID, session.User)
	if err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	liked := false
	for _, l := range lf.Likes {
		if strings.EqualFold(l.Login, session.User.Login) {
			liked = true
			break
		}
	}

	dto.WriteJSON(w, http.StatusOK, map[string]any{
		"likeCount": len(lf.Likes),
		"liked":     liked,
	})
}

// GetComments returns comments for a post.
func (controller *ImageController) GetComments(w http.ResponseWriter, r *http.Request) {
	ownerLogin := chi.URLParam(r, "ownerLogin")
	postID := chi.URLParam(r, "postID")

	var feedLogins []string
	session, _ := controller.authService.ReadSession(r)
	if session != nil {
		feedUsers, err := controller.userService.GetFeedUsers(r.Context(), session.AccessToken, session.User.Login)
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

	comments := controller.interactionService.GetAllComments(r.Context(), tokenFromSession(session), ownerLogin, postID, feedLogins)
	result := make([]dto.CommentResponse, 0, len(comments))
	for _, c := range comments {
		result = append(result, dto.CommentResponse{
			ID:          c.ID,
			AuthorLogin: c.AuthorLogin,
			PostOwner:   c.PostOwner,
			PostID:      c.PostID,
			Text:        c.Text,
			CreatedAt:   c.CreatedAt.Format("2006-01-02T15:04:05-07:00"),
		})
	}

	dto.WriteJSON(w, http.StatusOK, result)
}

// AddComment adds a comment on a post. The comment is stored in the commenter's repo.
func (controller *ImageController) AddComment(w http.ResponseWriter, r *http.Request) {
	ownerLogin := chi.URLParam(r, "ownerLogin")
	postID := chi.URLParam(r, "postID")

	session, ok := middleware.SessionFromContext(r.Context())
	if !ok {
		dto.WriteError(w, http.StatusUnauthorized, "missing session")
		return
	}

	// Ensure commenter has a repo
	if err := controller.userService.EnsureRepo(r.Context(), session.AccessToken, session.User.Login); err != nil {
		dto.WriteError(w, http.StatusBadGateway, fmt.Sprintf("无法创建数据仓库: %s", err.Error()))
		return
	}

	var body struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Text) == "" {
		dto.WriteError(w, http.StatusBadRequest, "请输入评论内容")
		return
	}

	comment, err := controller.interactionService.AddComment(r.Context(), session.AccessToken, session.User, ownerLogin, postID, strings.TrimSpace(body.Text))
	if err != nil {
		dto.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}

	dto.WriteJSON(w, http.StatusCreated, dto.CommentResponse{
		ID:          comment.ID,
		AuthorLogin: session.User.Login,
		PostOwner:   comment.PostOwner,
		PostID:      comment.PostID,
		Text:        comment.Text,
		CreatedAt:   comment.CreatedAt.Format("2006-01-02T15:04:05-07:00"),
	})
}

func readMultipartFiles(r *http.Request) ([][]byte, error) {
	fileHeaders := r.MultipartForm.File["files"]
	if len(fileHeaders) == 0 {
		fileHeaders = r.MultipartForm.File["file"]
	}
	if len(fileHeaders) > maxFiles {
		return nil, fmt.Errorf("最多上传 %d 张图片", maxFiles)
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