package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
)

type SupabaseStorage struct {
	restURL    string
	serviceKey string
	httpClient *http.Client
}

type imageRecord struct {
	ID           string    `json:"id"`
	AuthorLogin  string    `json:"author_login"`
	AuthorAvatar string    `json:"author_avatar"`
	Description  string    `json:"description"`
	Tags         []string  `json:"tags"`
	TimeMode     string    `json:"time_mode"`
	StartAt      time.Time `json:"start_at"`
	EndAt        time.Time `json:"end_at"`
	CapturedAt   time.Time `json:"captured_at"`
	ImagePaths   []string  `json:"image_paths"`
	MetadataPath string    `json:"metadata_path"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type likeRecord struct {
	PostOwner string    `json:"post_owner"`
	PostID    string    `json:"post_id"`
	Login     string    `json:"login"`
	AvatarURL string    `json:"avatar_url"`
	LikedAt   time.Time `json:"liked_at"`
}

type commentLikeRecord struct {
	CommentID string    `json:"comment_id"`
	PostOwner string    `json:"post_owner"`
	PostID    string    `json:"post_id"`
	Login     string    `json:"login"`
	AvatarURL string    `json:"avatar_url"`
	LikedAt   time.Time `json:"liked_at"`
}

type commentRecord struct {
	ID               string    `json:"id"`
	PostOwner        string    `json:"post_owner"`
	PostID           string    `json:"post_id"`
	AuthorLogin      string    `json:"author_login"`
	AuthorAvatar     string    `json:"author_avatar"`
	ParentID         string    `json:"parent_id"`
	ReplyToUserLogin string    `json:"reply_to_user_login"`
	Text             string    `json:"text"`
	ImagePaths       []string  `json:"image_paths"`
	Deleted          bool      `json:"deleted"`
	Hidden           bool      `json:"hidden"`
	CreatedAt        time.Time `json:"created_at"`
}

type followRecord struct {
	FollowerLogin  string    `json:"follower_login"`
	FollowingLogin string    `json:"following_login"`
	CreatedAt      time.Time `json:"created_at"`
}

type userRecord struct {
	Login      string    `json:"login"`
	Provider   string    `json:"provider"`
	ProviderID string    `json:"provider_id"`
	AvatarURL  string    `json:"avatar_url"`
	DisplayName string   `json:"display_name"`
	CreatedAt  time.Time `json:"created_at,omitempty"`
	UpdatedAt  time.Time `json:"updated_at,omitempty"`
}

type emailLoginRecord struct {
	TokenHash  string     `json:"token_hash"`
	Email      string     `json:"email"`
	Login      string     `json:"login"`
	AvatarURL  string     `json:"avatar_url"`
	CreatedAt  time.Time  `json:"created_at"`
	ExpiresAt  time.Time  `json:"expires_at"`
	ConsumedAt *time.Time `json:"consumed_at,omitempty"`
}

func (record userRecord) toAuthUser() model.AuthUser {
	return model.AuthUser{
		Provider:    record.Provider,
		ID:          record.ProviderID,
		Login:       record.Login,
		AvatarURL:   record.AvatarURL,
		DisplayName: record.DisplayName,
	}
}

func NewSupabaseStorage(baseURL string, serviceKey string) *SupabaseStorage {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed != "" && !strings.HasSuffix(trimmed, "/rest/v1") {
		trimmed += "/rest/v1"
	}

	return &SupabaseStorage{
		restURL:    trimmed,
		serviceKey: strings.TrimSpace(serviceKey),
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

func (storage *SupabaseStorage) ListImagesByAuthors(ctx context.Context, authorLogins []string) ([]model.Image, error) {
	if len(authorLogins) == 0 {
		return []model.Image{}, nil
	}

	params := url.Values{}
	params.Set("select", "id,author_login,author_avatar,description,tags,time_mode,start_at,end_at,captured_at,image_paths,metadata_path,created_at,updated_at")
	params.Set("author_login", inFilter(authorLogins))
	params.Set("order", "start_at.desc,created_at.desc")

	var records []imageRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/images", params, nil, &records, nil); err != nil {
		return nil, err
	}

	items := make([]model.Image, 0, len(records))
	for _, record := range records {
		items = append(items, record.toModel())
	}
	return items, nil
}

func (storage *SupabaseStorage) ListImagesByAuthor(ctx context.Context, authorLogin string) ([]model.Image, error) {
	return storage.ListImagesByAuthors(ctx, []string{authorLogin})
}

func (storage *SupabaseStorage) GetImage(ctx context.Context, authorLogin string, imageID string) (model.Image, error) {
	params := url.Values{}
	params.Set("select", "id,author_login,author_avatar,description,tags,time_mode,start_at,end_at,captured_at,image_paths,metadata_path,created_at,updated_at")
	params.Set("author_login", "eq."+authorLogin)
	params.Set("id", "eq."+imageID)
	params.Set("limit", "1")

	var records []imageRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/images", params, nil, &records, nil); err != nil {
		return model.Image{}, err
	}
	if len(records) == 0 {
		return model.Image{}, osErrNotFound(imageID)
	}
	return records[0].toModel(), nil
}

func (storage *SupabaseStorage) UpsertImage(ctx context.Context, image model.Image) error {
	prefer := []string{"resolution=merge-duplicates"}
	return storage.requestJSON(ctx, http.MethodPost, "/images", url.Values{"on_conflict": []string{"id"}}, []imageRecord{imageRecordFromModel(image)}, nil, prefer)
}

func (storage *SupabaseStorage) DeleteImage(ctx context.Context, authorLogin string, imageID string) error {
	params := url.Values{}
	params.Set("author_login", "eq."+authorLogin)
	params.Set("id", "eq."+imageID)
	return storage.requestJSON(ctx, http.MethodDelete, "/images", params, nil, nil, nil)
}

func (storage *SupabaseStorage) ListActiveAuthors(ctx context.Context) ([]model.GitHubUser, error) {
	params := url.Values{}
	params.Set("select", "author_login,author_avatar,updated_at")
	params.Set("order", "updated_at.desc")

	var records []struct {
		AuthorLogin  string    `json:"author_login"`
		AuthorAvatar string    `json:"author_avatar"`
		UpdatedAt    time.Time `json:"updated_at"`
	}
	if err := storage.requestJSON(ctx, http.MethodGet, "/images", params, nil, &records, nil); err != nil {
		return nil, err
	}

	seen := map[string]struct{}{}
	users := make([]model.GitHubUser, 0, len(records))
	for _, record := range records {
		key := strings.ToLower(strings.TrimSpace(record.AuthorLogin))
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		users = append(users, model.GitHubUser{Login: record.AuthorLogin, AvatarURL: record.AuthorAvatar})
	}

	sort.Slice(users, func(i, j int) bool {
		return strings.ToLower(users[i].Login) < strings.ToLower(users[j].Login)
	})
	return users, nil
}

func (storage *SupabaseStorage) ListLikes(ctx context.Context, ownerLogin string, postID string) (*model.LikeFile, error) {
	params := url.Values{}
	params.Set("select", "post_owner,post_id,login,avatar_url,liked_at")
	params.Set("post_owner", "eq."+ownerLogin)
	params.Set("post_id", "eq."+postID)
	params.Set("order", "liked_at.asc")

	var records []likeRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/likes", params, nil, &records, nil); err != nil {
		return nil, err
	}

	likes := make([]model.Like, 0, len(records))
	for _, record := range records {
		likes = append(likes, model.Like{Login: record.Login, AvatarURL: record.AvatarURL, LikedAt: record.LikedAt})
	}
	return &model.LikeFile{Likes: likes}, nil
}

func (storage *SupabaseStorage) ListLikesByPosts(ctx context.Context, ownerLogins []string, postIDs []string) ([]model.PostLike, error) {
	if len(ownerLogins) == 0 || len(postIDs) == 0 {
		return []model.PostLike{}, nil
	}

	params := url.Values{}
	params.Set("select", "post_owner,post_id,login,avatar_url,liked_at")
	params.Set("post_owner", inFilter(ownerLogins))
	params.Set("post_id", inFilter(postIDs))
	params.Set("order", "liked_at.asc")

	var records []likeRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/likes", params, nil, &records, nil); err != nil {
		return nil, err
	}

	likes := make([]model.PostLike, 0, len(records))
	for _, record := range records {
		likes = append(likes, model.PostLike{
			PostOwner: record.PostOwner,
			PostID:    record.PostID,
			Login:     record.Login,
			AvatarURL: record.AvatarURL,
			LikedAt:   record.LikedAt,
		})
	}
	return likes, nil
}

func (storage *SupabaseStorage) UpsertLike(ctx context.Context, ownerLogin string, postID string, like model.Like) error {
	payload := []likeRecord{{PostOwner: ownerLogin, PostID: postID, Login: like.Login, AvatarURL: like.AvatarURL, LikedAt: like.LikedAt}}
	prefer := []string{"resolution=merge-duplicates"}
	return storage.requestJSON(ctx, http.MethodPost, "/likes", url.Values{"on_conflict": []string{"post_owner,post_id,login"}}, payload, nil, prefer)
}

func (storage *SupabaseStorage) DeleteLike(ctx context.Context, ownerLogin string, postID string, login string) error {
	params := url.Values{}
	params.Set("post_owner", "eq."+ownerLogin)
	params.Set("post_id", "eq."+postID)
	params.Set("login", "eq."+login)
	return storage.requestJSON(ctx, http.MethodDelete, "/likes", params, nil, nil, nil)
}

func (storage *SupabaseStorage) ListCommentLikesByPost(ctx context.Context, postOwner string, postID string) ([]model.CommentLike, error) {
	params := url.Values{}
	params.Set("select", "comment_id,post_owner,post_id,login,avatar_url,liked_at")
	params.Set("post_owner", "eq."+postOwner)
	params.Set("post_id", "eq."+postID)
	params.Set("order", "liked_at.asc")

	var records []commentLikeRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/comment_likes", params, nil, &records, nil); err != nil {
		return nil, err
	}

	likes := make([]model.CommentLike, 0, len(records))
	for _, record := range records {
		likes = append(likes, model.CommentLike{
			CommentID: record.CommentID,
			PostOwner: record.PostOwner,
			PostID:    record.PostID,
			Login:     record.Login,
			AvatarURL: record.AvatarURL,
			LikedAt:   record.LikedAt,
		})
	}
	return likes, nil
}

func (storage *SupabaseStorage) ListCommentLikesByComment(ctx context.Context, commentID string) ([]model.CommentLike, error) {
	params := url.Values{}
	params.Set("select", "comment_id,post_owner,post_id,login,avatar_url,liked_at")
	params.Set("comment_id", "eq."+commentID)
	params.Set("order", "liked_at.asc")

	var records []commentLikeRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/comment_likes", params, nil, &records, nil); err != nil {
		return nil, err
	}

	likes := make([]model.CommentLike, 0, len(records))
	for _, record := range records {
		likes = append(likes, model.CommentLike{
			CommentID: record.CommentID,
			PostOwner: record.PostOwner,
			PostID:    record.PostID,
			Login:     record.Login,
			AvatarURL: record.AvatarURL,
			LikedAt:   record.LikedAt,
		})
	}
	return likes, nil
}

func (storage *SupabaseStorage) UpsertCommentLike(ctx context.Context, like model.CommentLike) error {
	payload := []commentLikeRecord{{
		CommentID: like.CommentID,
		PostOwner: like.PostOwner,
		PostID:    like.PostID,
		Login:     like.Login,
		AvatarURL: like.AvatarURL,
		LikedAt:   like.LikedAt,
	}}
	prefer := []string{"resolution=merge-duplicates"}
	return storage.requestJSON(ctx, http.MethodPost, "/comment_likes", url.Values{"on_conflict": []string{"comment_id,login"}}, payload, nil, prefer)
}

func (storage *SupabaseStorage) DeleteCommentLike(ctx context.Context, commentID string, login string) error {
	params := url.Values{}
	params.Set("comment_id", "eq."+commentID)
	params.Set("login", "eq."+login)
	return storage.requestJSON(ctx, http.MethodDelete, "/comment_likes", params, nil, nil, nil)
}

func (storage *SupabaseStorage) AddComment(ctx context.Context, comment model.Comment) error {
	return storage.requestJSON(ctx, http.MethodPost, "/comments", nil, []commentRecord{commentRecordFromModel(comment)}, nil, nil)
}

func (storage *SupabaseStorage) UpsertComment(ctx context.Context, comment model.Comment) error {
	prefer := []string{"resolution=merge-duplicates"}
	return storage.requestJSON(ctx, http.MethodPost, "/comments", url.Values{"on_conflict": []string{"id"}}, []commentRecord{commentRecordFromModel(comment)}, nil, prefer)
}

func (storage *SupabaseStorage) ListComments(ctx context.Context, postOwner string, postID string, authorLogins []string) ([]model.Comment, error) {
	if len(authorLogins) == 0 {
		return []model.Comment{}, nil
	}

	params := url.Values{}
	params.Set("select", "id,post_owner,post_id,author_login,author_avatar,parent_id,reply_to_user_login,text,image_paths,deleted,hidden,created_at")
	params.Set("post_owner", "eq."+postOwner)
	params.Set("post_id", "eq."+postID)
	params.Set("author_login", inFilter(authorLogins))
	params.Set("deleted", "eq.false")
	params.Set("hidden", "eq.false")
	params.Set("order", "created_at.asc")

	var records []commentRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/comments", params, nil, &records, nil); err != nil {
		return nil, err
	}

	comments := make([]model.Comment, 0, len(records))
	for _, record := range records {
		comments = append(comments, record.toModel())
	}
	return comments, nil
}

func (storage *SupabaseStorage) GetComment(ctx context.Context, commenterLogin string, postOwner string, postID string, commentID string) (model.Comment, error) {
	params := url.Values{}
	params.Set("select", "id,post_owner,post_id,author_login,author_avatar,parent_id,reply_to_user_login,text,image_paths,deleted,hidden,created_at")
	params.Set("author_login", "eq."+commenterLogin)
	params.Set("post_owner", "eq."+postOwner)
	params.Set("post_id", "eq."+postID)
	params.Set("id", "eq."+commentID)
	params.Set("limit", "1")

	var records []commentRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/comments", params, nil, &records, nil); err != nil {
		return model.Comment{}, err
	}
	if len(records) == 0 {
		return model.Comment{}, osErrNotFound(commentID)
	}
	return records[0].toModel(), nil
}

func (storage *SupabaseStorage) SetCommentDeleted(ctx context.Context, commenterLogin string, postOwner string, postID string, commentID string) error {
	params := url.Values{}
	params.Set("author_login", "eq."+commenterLogin)
	params.Set("post_owner", "eq."+postOwner)
	params.Set("post_id", "eq."+postID)
	params.Set("id", "eq."+commentID)
	return storage.requestJSON(ctx, http.MethodPatch, "/comments", params, map[string]bool{"deleted": true}, nil, nil)
}

func (storage *SupabaseStorage) SetCommentHidden(ctx context.Context, postOwner string, postID string, commentID string) error {
	params := url.Values{}
	params.Set("post_owner", "eq."+postOwner)
	params.Set("post_id", "eq."+postID)
	params.Set("id", "eq."+commentID)
	return storage.requestJSON(ctx, http.MethodPatch, "/comments", params, map[string]bool{"hidden": true}, nil, nil)
}

func (storage *SupabaseStorage) requestJSON(ctx context.Context, method string, tablePath string, params url.Values, body any, out any, prefer []string) error {
	if strings.TrimSpace(storage.restURL) == "" || strings.TrimSpace(storage.serviceKey) == "" {
		return fmt.Errorf("Supabase is not configured")
	}

	endpoint := storage.restURL + tablePath
	if encoded := params.Encode(); encoded != "" {
		endpoint += "?" + encoded
	}

	var requestBody io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return err
		}
		requestBody = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, requestBody)
	if err != nil {
		return err
	}

	req.Header.Set("apikey", storage.serviceKey)
	req.Header.Set("Authorization", "Bearer "+storage.serviceKey)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if len(prefer) > 0 {
		req.Header.Set("Prefer", strings.Join(prefer, ","))
	}

	resp, err := storage.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		payload, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase %s %s failed: %s", method, tablePath, strings.TrimSpace(string(payload)))
	}

	if out == nil || resp.StatusCode == http.StatusNoContent {
		return nil
	}

	return json.NewDecoder(resp.Body).Decode(out)
}

func (storage *SupabaseStorage) requestCount(ctx context.Context, tablePath string, params url.Values) (int, error) {
	if strings.TrimSpace(storage.restURL) == "" || strings.TrimSpace(storage.serviceKey) == "" {
		return 0, fmt.Errorf("Supabase is not configured")
	}

	endpoint := storage.restURL + tablePath
	if encoded := params.Encode(); encoded != "" {
		endpoint += "?" + encoded
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, err
	}

	req.Header.Set("apikey", storage.serviceKey)
	req.Header.Set("Authorization", "Bearer "+storage.serviceKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Prefer", "count=exact")
	req.Header.Set("Range", "0-0")

	resp, err := storage.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		payload, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("supabase %s %s failed: %s", http.MethodGet, tablePath, strings.TrimSpace(string(payload)))
	}

	if total, ok := parseContentRangeTotal(resp.Header.Get("Content-Range")); ok {
		return total, nil
	}

	// fallback: decode and count
	var records []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&records); err != nil {
		return 0, err
	}
	return len(records), nil
}

func parseContentRangeTotal(value string) (int, bool) {
	if value == "" {
		return 0, false
	}
	parts := strings.Split(value, "/")
	if len(parts) != 2 {
		return 0, false
	}
	totalRaw := strings.TrimSpace(parts[1])
	if totalRaw == "" || totalRaw == "*" {
		return 0, false
	}
	total, err := strconv.Atoi(totalRaw)
	if err != nil {
		return 0, false
	}
	return total, true
}

func imageRecordFromModel(image model.Image) imageRecord {
	return imageRecord{
		ID:           image.ID,
		AuthorLogin:  image.AuthorLogin,
		AuthorAvatar: image.AuthorAvatar,
		Description:  image.Description,
		Tags:         image.Tags,
		TimeMode:     image.TimeMode,
		StartAt:      image.StartAt,
		EndAt:        image.EndAt,
		CapturedAt:   image.CapturedAt,
		ImagePaths:   image.AllImagePaths(),
		MetadataPath: image.MetadataPath,
		CreatedAt:    image.CreatedAt,
		UpdatedAt:    image.UpdatedAt,
	}
}

func (record imageRecord) toModel() model.Image {
	return model.Image{
		ID:           record.ID,
		AuthorLogin:  record.AuthorLogin,
		AuthorAvatar: record.AuthorAvatar,
		Description:  record.Description,
		Tags:         record.Tags,
		TimeMode:     record.TimeMode,
		StartAt:      record.StartAt,
		EndAt:        record.EndAt,
		CapturedAt:   record.CapturedAt,
		ImagePaths:   record.ImagePaths,
		MetadataPath: record.MetadataPath,
		CreatedAt:    record.CreatedAt,
		UpdatedAt:    record.UpdatedAt,
	}
}

func commentRecordFromModel(comment model.Comment) commentRecord {
	return commentRecord{
		ID:               comment.ID,
		PostOwner:        comment.PostOwner,
		PostID:           comment.PostID,
		AuthorLogin:      comment.AuthorLogin,
		AuthorAvatar:     comment.AuthorAvatar,
		ParentID:         comment.ParentID,
		ReplyToUserLogin: comment.ReplyToUserLogin,
		Text:             comment.Text,
		ImagePaths:       comment.AllImagePaths(),
		Deleted:          comment.Deleted,
		Hidden:           comment.Hidden,
		CreatedAt:        comment.CreatedAt,
	}
}

func (record commentRecord) toModel() model.Comment {
	comment := model.Comment{
		ID:               record.ID,
		PostOwner:        record.PostOwner,
		PostID:           record.PostID,
		AuthorLogin:      record.AuthorLogin,
		AuthorAvatar:     record.AuthorAvatar,
		ParentID:         record.ParentID,
		ReplyToUserLogin: record.ReplyToUserLogin,
		Text:             record.Text,
		ImagePaths:       record.ImagePaths,
		Deleted:          record.Deleted,
		Hidden:           record.Hidden,
		CreatedAt:        record.CreatedAt,
	}
	if len(record.ImagePaths) == 1 {
		comment.ImagePath = record.ImagePaths[0]
	}
	return comment
}

func emailLoginRecordFromModel(login model.EmailLogin) emailLoginRecord {
	return emailLoginRecord{
		TokenHash:  login.TokenHash,
		Email:      login.Email,
		Login:      login.Login,
		AvatarURL:  login.AvatarURL,
		CreatedAt:  login.CreatedAt,
		ExpiresAt:  login.ExpiresAt,
		ConsumedAt: login.ConsumedAt,
	}
}

func (record emailLoginRecord) toModel() model.EmailLogin {
	return model.EmailLogin{
		TokenHash:  record.TokenHash,
		Email:      record.Email,
		Login:      record.Login,
		AvatarURL:  record.AvatarURL,
		CreatedAt:  record.CreatedAt,
		ExpiresAt:  record.ExpiresAt,
		ConsumedAt: record.ConsumedAt,
	}
}

func inFilter(values []string) string {
	parts := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("\"%s\"", strings.ReplaceAll(trimmed, "\"", "\\\"")))
	}
	return "in.(" + strings.Join(parts, ",") + ")"
}

func (storage *SupabaseStorage) ListCommentsByPosts(ctx context.Context, postOwners []string, postIDs []string, authorLogins []string) ([]model.Comment, error) {
	if len(postOwners) == 0 || len(postIDs) == 0 || len(authorLogins) == 0 {
		return []model.Comment{}, nil
	}

	params := url.Values{}
	params.Set("select", "id,post_owner,post_id,author_login,author_avatar,parent_id,reply_to_user_login,text,image_paths,deleted,hidden,created_at")
	params.Set("post_owner", inFilter(postOwners))
	params.Set("post_id", inFilter(postIDs))
	params.Set("author_login", inFilter(authorLogins))
	params.Set("deleted", "eq.false")
	params.Set("hidden", "eq.false")
	params.Set("order", "created_at.asc")

	var records []commentRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/comments", params, nil, &records, nil); err != nil {
		return nil, err
	}

	comments := make([]model.Comment, 0, len(records))
	for _, record := range records {
		comments = append(comments, record.toModel())
	}
	return comments, nil
}

func (storage *SupabaseStorage) FollowUser(ctx context.Context, followerLogin string, followingLogin string) error {
	payload := []followRecord{{
		FollowerLogin:  followerLogin,
		FollowingLogin: followingLogin,
		CreatedAt:      time.Now(),
	}}
	prefer := []string{"resolution=merge-duplicates"}
	return storage.requestJSON(ctx, http.MethodPost, "/follows", url.Values{"on_conflict": []string{"follower_login,following_login"}}, payload, nil, prefer)
}

func (storage *SupabaseStorage) UnfollowUser(ctx context.Context, followerLogin string, followingLogin string) error {
	params := url.Values{}
	params.Set("follower_login", "eq."+followerLogin)
	params.Set("following_login", "eq."+followingLogin)
	return storage.requestJSON(ctx, http.MethodDelete, "/follows", params, nil, nil, nil)
}

func (storage *SupabaseStorage) UpsertUser(ctx context.Context, user model.AuthUser) error {
	now := time.Now()
	item := map[string]any{
		"login":       user.Login,
		"provider":    user.Provider,
		"provider_id": user.ID,
		"updated_at":  now,
	}
	if strings.TrimSpace(user.AvatarURL) != "" {
		item["avatar_url"] = user.AvatarURL
	}
	if strings.TrimSpace(user.DisplayName) != "" {
		item["display_name"] = user.DisplayName
	}
	payload := []map[string]any{item}
	prefer := []string{"resolution=merge-duplicates"}
	return storage.requestJSON(ctx, http.MethodPost, "/users", url.Values{"on_conflict": []string{"login"}}, payload, nil, prefer)
}

func (storage *SupabaseStorage) GetUser(ctx context.Context, login string) (model.AuthUser, error) {
	params := url.Values{}
	params.Set("select", "login,provider,provider_id,avatar_url,display_name")
	params.Set("login", "eq."+login)
	params.Set("limit", "1")

	var records []userRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/users", params, nil, &records, nil); err != nil {
		return model.AuthUser{}, err
	}
	if len(records) == 0 {
		return model.AuthUser{}, osErrNotFound(login)
	}
	return records[0].toAuthUser(), nil
}

func (storage *SupabaseStorage) UpdateUserProfile(ctx context.Context, login string, displayName *string, avatarURL *string) error {
	if strings.TrimSpace(login) == "" {
		return nil
	}

	payload := map[string]any{
		"updated_at": time.Now(),
	}
	if displayName != nil {
		payload["display_name"] = strings.TrimSpace(*displayName)
	}
	if avatarURL != nil {
		payload["avatar_url"] = strings.TrimSpace(*avatarURL)
	}
	if len(payload) == 1 {
		return nil
	}

	params := url.Values{}
	params.Set("login", "eq."+login)
	return storage.requestJSON(ctx, http.MethodPatch, "/users", params, payload, nil, nil)
}

func (storage *SupabaseStorage) CreateEmailLogin(ctx context.Context, login model.EmailLogin) error {
	payload := []emailLoginRecord{emailLoginRecordFromModel(login)}
	return storage.requestJSON(ctx, http.MethodPost, "/email_logins", nil, payload, nil, nil)
}

func (storage *SupabaseStorage) GetEmailLogin(ctx context.Context, tokenHash string) (model.EmailLogin, error) {
	params := url.Values{}
	params.Set("select", "token_hash,email,login,avatar_url,created_at,expires_at,consumed_at")
	params.Set("token_hash", "eq."+tokenHash)
	params.Set("limit", "1")

	var records []emailLoginRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/email_logins", params, nil, &records, nil); err != nil {
		return model.EmailLogin{}, err
	}
	if len(records) == 0 {
		return model.EmailLogin{}, osErrNotFound(tokenHash)
	}
	return records[0].toModel(), nil
}

func (storage *SupabaseStorage) ConsumeEmailLogin(ctx context.Context, tokenHash string, consumedAt time.Time) error {
	params := url.Values{}
	params.Set("token_hash", "eq."+tokenHash)
	return storage.requestJSON(ctx, http.MethodPatch, "/email_logins", params, map[string]any{
		"consumed_at": consumedAt,
	}, nil, nil)
}

func (storage *SupabaseStorage) CountUsers(ctx context.Context) (int, error) {
	params := url.Values{}
	params.Set("select", "login")
	return storage.requestCount(ctx, "/user_logins", params)
}

func (storage *SupabaseStorage) ListFollowing(ctx context.Context, followerLogin string) ([]string, error) {
	params := url.Values{}
	params.Set("select", "following_login")
	params.Set("follower_login", "eq."+followerLogin)

	var records []followRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/follows", params, nil, &records, nil); err != nil {
		return nil, err
	}

	following := make([]string, 0, len(records))
	for _, record := range records {
		following = append(following, record.FollowingLogin)
	}
	return following, nil
}

func (storage *SupabaseStorage) ListFollowers(ctx context.Context, followingLogin string) ([]string, error) {
	params := url.Values{}
	params.Set("select", "follower_login")
	params.Set("following_login", "eq."+followingLogin)

	var records []followRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/follows", params, nil, &records, nil); err != nil {
		return nil, err
	}

	followers := make([]string, 0, len(records))
	for _, record := range records {
		followers = append(followers, record.FollowerLogin)
	}
	return followers, nil
}

func (storage *SupabaseStorage) GetUsersByLogins(ctx context.Context, logins []string) ([]model.GitHubUser, error) {
	if len(logins) == 0 {
		return []model.GitHubUser{}, nil
	}

	params := url.Values{}
	params.Set("select", "author_login,author_avatar,updated_at")
	params.Set("author_login", inFilter(logins))
	params.Set("order", "updated_at.desc")

	// We query the images table to get their latest avatar.
	// This relies on the fact that any user with content has their avatar recorded.
	var records []struct {
		AuthorLogin  string    `json:"author_login"`
		AuthorAvatar string    `json:"author_avatar"`
		UpdatedAt    time.Time `json:"updated_at"`
	}
	if err := storage.requestJSON(ctx, http.MethodGet, "/images", params, nil, &records, nil); err != nil {
		return nil, err
	}

	seen := map[string]struct{}{}
	users := make([]model.GitHubUser, 0, len(records))
	for _, record := range records {
		key := strings.ToLower(strings.TrimSpace(record.AuthorLogin))
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		users = append(users, model.GitHubUser{Login: record.AuthorLogin, AvatarURL: record.AuthorAvatar})
	}
	return users, nil
}

// GetSetting reads a JSON value from the settings table by key.
func (storage *SupabaseStorage) GetSetting(ctx context.Context, key string) (json.RawMessage, error) {
	params := url.Values{}
	params.Set("select", "value")
	params.Set("key", "eq."+key)
	params.Set("limit", "1")

	var records []struct {
		Value json.RawMessage `json:"value"`
	}
	if err := storage.requestJSON(ctx, http.MethodGet, "/settings", params, nil, &records, nil); err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, nil
	}
	return records[0].Value, nil
}

// UpsertSetting writes a JSON value to the settings table.
func (storage *SupabaseStorage) UpsertSetting(ctx context.Context, key string, value json.RawMessage) error {
	payload := []map[string]any{{
		"key":        key,
		"value":      value,
		"updated_at": time.Now().UTC(),
	}}
	prefer := []string{"resolution=merge-duplicates"}
	return storage.requestJSON(ctx, http.MethodPost, "/settings", url.Values{"on_conflict": []string{"key"}}, payload, nil, prefer)
}

// DeleteSetting removes a setting row by key.
func (storage *SupabaseStorage) DeleteSetting(ctx context.Context, key string) error {
	params := url.Values{}
	params.Set("key", "eq."+key)
	return storage.requestJSON(ctx, http.MethodDelete, "/settings", params, nil, nil, nil)
}

// --- Registration system ---

func (storage *SupabaseStorage) CreatePendingUser(ctx context.Context, login, provider, providerID, email, purpose, inviteCode, registerMethod, avatarURL, displayName string) error {
	now := time.Now()
	payload := []map[string]any{{
		"login":           login,
		"provider":        provider,
		"provider_id":     providerID,
		"email":           email,
		"purpose":         purpose,
		"status":          "pending",
		"invite_code":     inviteCode,
		"register_method": registerMethod,
		"avatar_url":      avatarURL,
		"display_name":    displayName,
		"created_at":      now,
		"updated_at":      now,
	}}
	return storage.requestJSON(ctx, http.MethodPost, "/users", nil, payload, nil, nil)
}

func (storage *SupabaseStorage) GetUserByEmail(ctx context.Context, email string) (map[string]any, error) {
	params := url.Values{}
	params.Set("select", "login,provider,provider_id,email,purpose,status,invite_code,register_method,avatar_url,display_name,created_at,updated_at")
	params.Set("email", "eq."+email)
	params.Set("limit", "1")

	var records []map[string]any
	if err := storage.requestJSON(ctx, http.MethodGet, "/users", params, nil, &records, nil); err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, nil
	}
	return records[0], nil
}

func (storage *SupabaseStorage) UpdateUserStatus(ctx context.Context, login string, status string) error {
	params := url.Values{}
	params.Set("login", "eq."+login)
	return storage.requestJSON(ctx, http.MethodPatch, "/users", params, map[string]any{
		"status":     status,
		"updated_at": time.Now(),
	}, nil, nil)
}

func (storage *SupabaseStorage) ListPendingUsers(ctx context.Context) ([]map[string]any, error) {
	params := url.Values{}
	params.Set("select", "login,provider,email,purpose,status,register_method,avatar_url,display_name,created_at")
	params.Set("status", "eq.pending")
	params.Set("order", "created_at.desc")

	var records []map[string]any
	if err := storage.requestJSON(ctx, http.MethodGet, "/users", params, nil, &records, nil); err != nil {
		return nil, err
	}
	return records, nil
}

func (storage *SupabaseStorage) GetUserStatus(ctx context.Context, login string) (string, error) {
	params := url.Values{}
	params.Set("select", "status")
	params.Set("login", "eq."+login)
	params.Set("limit", "1")

	var records []struct {
		Status string `json:"status"`
	}
	if err := storage.requestJSON(ctx, http.MethodGet, "/users", params, nil, &records, nil); err != nil {
		return "", err
	}
	if len(records) == 0 {
		return "", nil
	}
	return records[0].Status, nil
}

func (storage *SupabaseStorage) GetUserFullByLogin(ctx context.Context, login string) (map[string]any, error) {
	params := url.Values{}
	params.Set("select", "login,provider,provider_id,email,purpose,status,invite_code,register_method,avatar_url,display_name,created_at,updated_at")
	params.Set("login", "eq."+login)
	params.Set("limit", "1")

	var records []map[string]any
	if err := storage.requestJSON(ctx, http.MethodGet, "/users", params, nil, &records, nil); err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, nil
	}
	return records[0], nil
}

func (storage *SupabaseStorage) GetUserEmail(ctx context.Context, login string) (string, error) {
	params := url.Values{}
	params.Set("select", "email")
	params.Set("login", "eq."+login)
	params.Set("limit", "1")

	var records []map[string]any
	if err := storage.requestJSON(ctx, http.MethodGet, "/users", params, nil, &records, nil); err != nil {
		return "", err
	}
	if len(records) == 0 {
		return "", nil
	}
	email, _ := records[0]["email"].(string)
	return strings.TrimSpace(email), nil
}

func (storage *SupabaseStorage) UpdateUserEmail(ctx context.Context, login string, email string) error {
	params := url.Values{}
	params.Set("login", "eq."+login)
	return storage.requestJSON(ctx, http.MethodPatch, "/users", params, map[string]any{
		"email":      email,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}, nil, nil)
}

// --- Rejection history ---

type RejectionRecord struct {
	ID         int       `json:"id"`
	UserLogin  string    `json:"user_login"`
	Reason     string    `json:"reason"`
	RejectedAt time.Time `json:"rejected_at"`
}

func (storage *SupabaseStorage) SaveRejectionHistory(ctx context.Context, login, reason string) error {
	payload := []map[string]any{{
		"user_login":  login,
		"reason":      reason,
		"rejected_at": time.Now().UTC(),
	}}
	return storage.requestJSON(ctx, http.MethodPost, "/rejection_history", nil, payload, nil, nil)
}

func (storage *SupabaseStorage) GetRejectionHistory(ctx context.Context, login string) ([]RejectionRecord, error) {
	params := url.Values{}
	params.Set("select", "id,user_login,reason,rejected_at")
	params.Set("user_login", "eq."+login)
	params.Set("order", "rejected_at.asc")

	var records []RejectionRecord
	if err := storage.requestJSON(ctx, http.MethodGet, "/rejection_history", params, nil, &records, nil); err != nil {
		return nil, err
	}
	return records, nil
}

// --- User identities (multi-provider binding) ---

type UserIdentity struct {
	ID          int       `json:"id"`
	UserLogin   string    `json:"user_login"`
	Provider    string    `json:"provider"`
	ProviderID  string    `json:"provider_id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

func (storage *SupabaseStorage) CreateUserIdentity(ctx context.Context, login, provider, providerID, email, displayName string) error {
	payload := []map[string]any{{
		"user_login":   login,
		"provider":     provider,
		"provider_id":  providerID,
		"email":        email,
		"display_name": displayName,
		"created_at":   time.Now().UTC(),
	}}
	return storage.requestJSON(ctx, http.MethodPost, "/user_identities", nil, payload, nil, nil)
}

func (storage *SupabaseStorage) GetUserIdentities(ctx context.Context, login string) ([]UserIdentity, error) {
	params := url.Values{}
	params.Set("select", "id,user_login,provider,provider_id,email,display_name,created_at")
	params.Set("user_login", "eq."+login)
	params.Set("order", "created_at.asc")

	var records []UserIdentity
	if err := storage.requestJSON(ctx, http.MethodGet, "/user_identities", params, nil, &records, nil); err != nil {
		return nil, err
	}
	return records, nil
}

func (storage *SupabaseStorage) FindUserByIdentity(ctx context.Context, provider, providerID string) (string, bool, error) {
	params := url.Values{}
	params.Set("select", "user_login")
	params.Set("provider", "eq."+provider)
	params.Set("provider_id", "eq."+providerID)
	params.Set("limit", "1")

	var records []struct {
		UserLogin string `json:"user_login"`
	}
	if err := storage.requestJSON(ctx, http.MethodGet, "/user_identities", params, nil, &records, nil); err != nil {
		return "", false, err
	}
	if len(records) == 0 {
		return "", false, nil
	}
	return records[0].UserLogin, true, nil
}

func (storage *SupabaseStorage) FindUserByIdentityEmail(ctx context.Context, email string) (string, bool, error) {
	params := url.Values{}
	params.Set("select", "user_login")
	params.Set("provider", "eq.email")
	params.Set("email", "eq."+email)
	params.Set("limit", "1")

	var records []struct {
		UserLogin string `json:"user_login"`
	}
	if err := storage.requestJSON(ctx, http.MethodGet, "/user_identities", params, nil, &records, nil); err != nil {
		return "", false, err
	}
	if len(records) == 0 {
		return "", false, nil
	}
	return records[0].UserLogin, true, nil
}

func (storage *SupabaseStorage) DeleteUserIdentity(ctx context.Context, login, provider string) error {
	params := url.Values{}
	params.Set("user_login", "eq."+login)
	params.Set("provider", "eq."+provider)
	return storage.requestJSON(ctx, http.MethodDelete, "/user_identities", params, nil, nil, nil)
}

func (storage *SupabaseStorage) CountUserIdentities(ctx context.Context, login string) (int, error) {
	params := url.Values{}
	params.Set("user_login", "eq."+login)
	return storage.requestCount(ctx, "/user_identities", params)
}

// UpdatePendingUser updates purpose and status for a rejected user re-applying
func (storage *SupabaseStorage) UpdatePendingUser(ctx context.Context, login, purpose, inviteCode string) error {
	params := url.Values{}
	params.Set("login", "eq."+login)
	return storage.requestJSON(ctx, http.MethodPatch, "/users", params, map[string]any{
		"purpose":     purpose,
		"invite_code": inviteCode,
		"status":      "pending",
		"updated_at":  time.Now().UTC(),
	}, nil, nil)
}