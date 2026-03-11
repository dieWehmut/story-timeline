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
	PostOwner  string    `json:"post_owner"`
	PostID     string    `json:"post_id"`
	Login      string    `json:"login"`
	AvatarURL  string    `json:"avatar_url"`
	LikedAt    time.Time `json:"liked_at"`
}

type commentRecord struct {
	ID           string    `json:"id"`
	PostOwner    string    `json:"post_owner"`
	PostID       string    `json:"post_id"`
	AuthorLogin  string    `json:"author_login"`
	AuthorAvatar string    `json:"author_avatar"`
	ParentID     string    `json:"parent_id"`
	ReplyToUserLogin string `json:"reply_to_user_login"`
	Text         string    `json:"text"`
	ImagePaths   []string  `json:"image_paths"`
	Deleted      bool      `json:"deleted"`
	Hidden       bool      `json:"hidden"`
	CreatedAt    time.Time `json:"created_at"`
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
		ID:           comment.ID,
		PostOwner:    comment.PostOwner,
		PostID:       comment.PostID,
		AuthorLogin:  comment.AuthorLogin,
		AuthorAvatar: comment.AuthorAvatar,
		ParentID:     comment.ParentID,
		ReplyToUserLogin: comment.ReplyToUserLogin,
		Text:         comment.Text,
		ImagePaths:   comment.AllImagePaths(),
		Deleted:      comment.Deleted,
		Hidden:       comment.Hidden,
		CreatedAt:    comment.CreatedAt,
	}
}

func (record commentRecord) toModel() model.Comment {
	comment := model.Comment{
		ID:           record.ID,
		PostOwner:    record.PostOwner,
		PostID:       record.PostID,
		AuthorLogin:  record.AuthorLogin,
		AuthorAvatar: record.AuthorAvatar,
		ParentID:     record.ParentID,
		ReplyToUserLogin: record.ReplyToUserLogin,
		Text:         record.Text,
		ImagePaths:   record.ImagePaths,
		Deleted:      record.Deleted,
		Hidden:       record.Hidden,
		CreatedAt:    record.CreatedAt,
	}
	if len(record.ImagePaths) == 1 {
		comment.ImagePath = record.ImagePaths[0]
	}
	return comment
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
