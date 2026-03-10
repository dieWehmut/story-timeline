package service

import (
	"context"
	"fmt"
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
	assets     *storage.R2Storage
	adminLogin string
	mu         sync.Mutex
}

func NewImageService(_ context.Context, database *storage.SupabaseStorage, assets *storage.R2Storage, adminLogin string) (*ImageService, error) {
	if database == nil {
		return nil, fmt.Errorf("supabase storage is required")
	}
	if assets == nil {
		return nil, fmt.Errorf("R2 storage is required")
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

func (service *ImageService) Create(ctx context.Context, _ string, author model.GitHubUser, description string, tags []string, timeMode string, startAt time.Time, endAt time.Time, files [][]byte) (model.Image, error) {
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

	imagePaths, err := service.uploadImageAssets(ctx, author.Login, imageID, files)
	if err != nil {
		return model.Image{}, err
	}
	image.ImagePaths = imagePaths

	if err := service.database.UpsertImage(ctx, image); err != nil {
		return model.Image{}, err
	}

	return image, nil
}

func (service *ImageService) Update(ctx context.Context, _ string, ownerLogin string, id string, description string, tags []string, timeMode string, startAt time.Time, endAt time.Time, files [][]byte) (model.Image, error) {
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
		newPaths, uploadErr := service.uploadImageAssets(ctx, ownerLogin, id, files)
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

func (service *ImageService) uploadImageAssets(ctx context.Context, ownerLogin string, imageID string, files [][]byte) ([]string, error) {
	paths := make([]string, 0, len(files))
	for index, file := range files {
		objectKey := imageObjectKey(ownerLogin, imageID, index)
		if err := service.assets.PutObject(ctx, objectKey, file, "image/webp"); err != nil {
			return nil, err
		}
		paths = append(paths, objectKey)
	}
	return paths, nil
}

func imageObjectKey(ownerLogin string, imageID string, assetIndex int) string {
	return fmt.Sprintf("images/%s/%s/%d.webp", ownerLogin, imageID, assetIndex)
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