package service

import (
	"context"
	"fmt"
	"mime"
	"mime/multipart"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

type ImageService struct {
	database   *storage.SupabaseStorage
	assets     *storage.CloudinaryStorage
	adminLogin string
	mu         sync.Mutex
}

func NewImageService(_ context.Context, database *storage.SupabaseStorage, assets *storage.CloudinaryStorage, adminLogin string) (*ImageService, error) {
	if database == nil {
		return nil, fmt.Errorf("supabase storage is required")
	}
	if assets == nil {
		return nil, fmt.Errorf("Cloudinary storage is required")
	}

	return &ImageService{
		database:   database,
		assets:     assets,
		adminLogin: strings.TrimSpace(adminLogin),
	}, nil
}

func (service *ImageService) GetFeed(ctx context.Context, _ string, feedLogins []string) []model.Image {
	logins := uniqueStrings(append(feedLogins, service.adminLogin))
	items, err := service.database.ListImagesByAuthors(ctx, logins)
	if err != nil {
		return []model.Image{}
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].SortTime().After(items[j].SortTime())
	})
	return items
}

func (service *ImageService) GetUserItems(ctx context.Context, _ string, login string) []model.Image {
	items, err := service.database.ListImagesByAuthor(ctx, login)
	if err != nil {
		return []model.Image{}
	}
	return items
}

func (service *ImageService) Create(ctx context.Context, _ string, author model.GitHubUser, description string, tags []string, timeMode string, startAt time.Time, endAt time.Time, files []*multipart.FileHeader) (model.Image, error) {
	service.mu.Lock()
	defer service.mu.Unlock()

	now := utils.NowBeijing()
	imageID := utils.NewID()
	image := model.Image{
		ID:           imageID,
		AuthorLogin:  author.Login,
		AuthorAvatar: author.AvatarURL,
		Description:  description,
		Tags:         normalizeTags(tags),
		TimeMode:     timeMode,
		StartAt:      startAt,
		EndAt:        endAt,
		CapturedAt:   startAt,
		MetadataPath: metadataPath(author.Login, imageID),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	image.NormalizeTimeFields()

	imagePaths, err := service.uploadAssets(ctx, author.Login, imageID, files)
	if err != nil {
		return model.Image{}, err
	}
	image.ImagePaths = imagePaths

	if err := service.database.UpsertImage(ctx, image); err != nil {
		return model.Image{}, err
	}

	return image, nil
}

func (service *ImageService) Update(ctx context.Context, _ string, ownerLogin string, id string, description string, tags []string, timeMode string, startAt time.Time, endAt time.Time, files []*multipart.FileHeader) (model.Image, error) {
	service.mu.Lock()
	defer service.mu.Unlock()

	current, err := service.database.GetImage(ctx, ownerLogin, id)
	if err != nil {
		return model.Image{}, err
	}

	updated := current
	updated.Description = description
	updated.Tags = normalizeTags(tags)
	updated.TimeMode = timeMode
	updated.StartAt = startAt
	updated.EndAt = endAt
	updated.CapturedAt = startAt
	updated.UpdatedAt = utils.NowBeijing()
	updated.NormalizeTimeFields()

	if len(files) > 0 {
		newPaths, uploadErr := service.uploadAssets(ctx, ownerLogin, id, files)
		if uploadErr != nil {
			return model.Image{}, uploadErr
		}
		oldPaths := current.AllImagePaths()
		updated.ImagePaths = newPaths
		updated.ImagePath = ""
		for _, oldPath := range oldPaths {
			if !containsString(newPaths, oldPath) {
				_ = service.assets.DeleteObject(ctx, oldPath)
			}
		}
	}

	if err := service.database.UpsertImage(ctx, updated); err != nil {
		return model.Image{}, err
	}

	return updated, nil
}

func (service *ImageService) Delete(ctx context.Context, _ string, ownerLogin string, id string) error {
	service.mu.Lock()
	defer service.mu.Unlock()

	item, err := service.database.GetImage(ctx, ownerLogin, id)
	if err != nil {
		return err
	}

	for _, objectKey := range item.AllImagePaths() {
		if deleteErr := service.assets.DeleteObject(ctx, objectKey); deleteErr != nil {
			return deleteErr
		}
	}

	return service.database.DeleteImage(ctx, ownerLogin, id)
}

func (service *ImageService) ReadAsset(ctx context.Context, _ string, ownerLogin string, id string, assetIndex int) ([]byte, string, error) {
	item, err := service.database.GetImage(ctx, ownerLogin, id)
	if err != nil {
		return nil, "", err
	}

	paths := item.AllImagePaths()
	if assetIndex < 0 || assetIndex >= len(paths) {
		return nil, "", fmt.Errorf("asset index %d out of range", assetIndex)
	}

	return service.assets.GetObject(ctx, paths[assetIndex])
}

func (service *ImageService) AssetURL(ctx context.Context, ownerLogin string, id string, assetIndex int) (string, error) {
	item, err := service.database.GetImage(ctx, ownerLogin, id)
	if err != nil {
		return "", err
	}

	paths := item.AllImagePaths()
	if assetIndex < 0 || assetIndex >= len(paths) {
		return "", fmt.Errorf("asset index %d out of range", assetIndex)
	}
	if service.assets == nil {
		return "", fmt.Errorf("asset storage unavailable")
	}
	return service.assets.URLFor(paths[assetIndex]), nil
}

func (service *ImageService) uploadAssets(ctx context.Context, ownerLogin string, imageID string, files []*multipart.FileHeader) ([]string, error) {
	paths := make([]string, 0, len(files))
	for index, fh := range files {
		mediaType := mediaTypeFromFileHeader(fh)
		objectKey := imageObjectKey(ownerLogin, imageID, index)
		if mediaType == "video" {
			objectKey = videoObjectKey(ownerLogin, imageID, index)
		}

		contentType := strings.TrimSpace(fh.Header.Get("Content-Type"))
		if contentType == "" {
			contentType = mime.TypeByExtension(strings.ToLower(filepath.Ext(fh.Filename)))
		}

		f, err := fh.Open()
		if err != nil {
			return nil, err
		}
		uploadErr := service.assets.PutObjectReader(ctx, objectKey, f, contentType)
		_ = f.Close()
		if uploadErr != nil {
			return nil, uploadErr
		}

		paths = append(paths, objectKey)
	}
	return paths, nil
}

func imageObjectKey(ownerLogin string, imageID string, assetIndex int) string {
	return fmt.Sprintf("images/%s/%s/%d", ownerLogin, imageID, assetIndex)
}

func videoObjectKey(ownerLogin string, imageID string, assetIndex int) string {
	return fmt.Sprintf("videos/%s/%s/%d", ownerLogin, imageID, assetIndex)
}

func mediaTypeFromFileHeader(fh *multipart.FileHeader) string {
	contentType := strings.ToLower(strings.TrimSpace(fh.Header.Get("Content-Type")))
	if strings.HasPrefix(contentType, "video/") {
		return "video"
	}
	if strings.HasPrefix(contentType, "image/") {
		return "image"
	}

	switch strings.ToLower(filepath.Ext(fh.Filename)) {
	case ".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv":
		return "video"
	}

	return "image"
}

func metadataPath(ownerLogin string, imageID string) string {
	return fmt.Sprintf("supabase/images/%s/%s", ownerLogin, imageID)
}

func normalizeTags(tags []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(tags))
	for _, tag := range tags {
		trimmed := strings.TrimSpace(tag)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func uniqueStrings(input []string) []string {
	seen := map[string]struct{}{}
	var result []string
	for _, value := range input {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}
