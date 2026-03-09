package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

type ImageService struct {
	storage   *storage.GitHubStorage
	cacheFile string
	mu        sync.RWMutex
	items     []model.Image
}

func NewImageService(ctx context.Context, repository *storage.GitHubStorage, cacheFile string) (*ImageService, error) {
	service := &ImageService{storage: repository, cacheFile: cacheFile}
	if err := service.bootstrap(ctx); err != nil {
		return nil, err
	}

	return service, nil
}

func (service *ImageService) List() []model.Image {
	service.mu.RLock()
	defer service.mu.RUnlock()

	items := append([]model.Image(nil), service.items...)
	sort.Slice(items, func(left int, right int) bool {
		return items[left].CapturedAt.After(items[right].CapturedAt)
	})

	return items
}

func (service *ImageService) Create(ctx context.Context, token string, author model.GitHubUser, description string, capturedAt time.Time, files [][]byte) (model.Image, error) {
	service.mu.Lock()
	defer service.mu.Unlock()

	now := utils.NowBeijing()
	metadataPath := service.nextMetadataPath(capturedAt)
	var imagePaths []string
	for i, file := range files {
		imagePaths = append(imagePaths, service.nextImagePath(capturedAt, i))
		if err := service.storage.PutFile(ctx, token, imagePaths[i], file, fmt.Sprintf("Add image %d for post", i+1)); err != nil {
			return model.Image{}, err
		}
	}

	image := model.Image{
		ID:           utils.NewID(),
		AuthorLogin:  author.Login,
		AuthorAvatar: author.AvatarURL,
		Description:  description,
		CapturedAt:   capturedAt,
		ImagePaths:   imagePaths,
		MetadataPath: metadataPath,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := service.writeMetadata(ctx, token, image); err != nil {
		return model.Image{}, err
	}

	service.items = append(service.items, image)
	if err := service.persistIndex(ctx, token); err != nil {
		return model.Image{}, err
	}

	return image, nil
}

func (service *ImageService) Update(ctx context.Context, token string, id string, description string, capturedAt time.Time, files [][]byte) (model.Image, error) {
	service.mu.Lock()
	defer service.mu.Unlock()

	index := -1
	for currentIndex, item := range service.items {
		if item.ID == id {
			index = currentIndex
			break
		}
	}
	if index == -1 {
		return model.Image{}, fmt.Errorf("image %s not found", id)
	}

	current := service.items[index]
	updated := current
	updated.Description = description
	updated.CapturedAt = capturedAt
	updated.UpdatedAt = utils.NowBeijing()

	if len(files) > 0 {
		// Upload new files
		var newPaths []string
		for i, file := range files {
			p := service.nextImagePath(capturedAt, i)
			newPaths = append(newPaths, p)
			if err := service.storage.PutFile(ctx, token, p, file, fmt.Sprintf("Update image %d for %s", i+1, id)); err != nil {
				return model.Image{}, err
			}
		}
		// Delete old files
		for _, oldPath := range current.AllImagePaths() {
			_ = service.storage.DeleteFile(ctx, token, oldPath, fmt.Sprintf("Remove old image %s", id))
		}
		updated.ImagePaths = newPaths
		updated.ImagePath = ""
	} else {
		// No new files — check if date moved
		moved := !utils.SameBeijingDay(current.CapturedAt, capturedAt)
		if moved {
			oldPaths := current.AllImagePaths()
			var newPaths []string
			for i, oldPath := range oldPaths {
				existingImage, _, _, err := service.storage.GetFile(ctx, token, oldPath)
				if err != nil {
					return model.Image{}, err
				}
				newPath := service.nextImagePath(capturedAt, i)
				newPaths = append(newPaths, newPath)
				if err := service.storage.PutFile(ctx, token, newPath, existingImage, fmt.Sprintf("Move image %s", id)); err != nil {
					return model.Image{}, err
				}
			}
			for _, oldPath := range oldPaths {
				_ = service.storage.DeleteFile(ctx, token, oldPath, fmt.Sprintf("Remove old image %s", id))
			}
			updated.ImagePaths = newPaths
			updated.ImagePath = ""
		}
	}

	// Clean up old metadata if path changed
	newMetadataPath := service.nextMetadataPath(capturedAt)
	if newMetadataPath != current.MetadataPath {
		_ = service.storage.DeleteFile(ctx, token, current.MetadataPath, fmt.Sprintf("Remove old metadata %s", id))
	}
	updated.MetadataPath = newMetadataPath

	if err := service.writeMetadata(ctx, token, updated); err != nil {
		return model.Image{}, err
	}

	service.items[index] = updated
	if err := service.persistIndex(ctx, token); err != nil {
		return model.Image{}, err
	}

	return updated, nil
}

func (service *ImageService) Delete(ctx context.Context, token string, id string) error {
	service.mu.Lock()
	defer service.mu.Unlock()

	index := -1
	for currentIndex, item := range service.items {
		if item.ID == id {
			index = currentIndex
			break
		}
	}
	if index == -1 {
		return fmt.Errorf("image %s not found", id)
	}

	item := service.items[index]
	for _, imgPath := range item.AllImagePaths() {
		if err := service.storage.DeleteFile(ctx, token, imgPath, fmt.Sprintf("Delete image %s", item.ID)); err != nil {
			return err
		}
	}
	if err := service.storage.DeleteFile(ctx, token, item.MetadataPath, fmt.Sprintf("Delete metadata %s", item.ID)); err != nil {
		return err
	}

	service.items = append(service.items[:index], service.items[index+1:]...)
	return service.persistIndex(ctx, token)
}

func (service *ImageService) GetByID(id string) (model.Image, bool) {
	service.mu.RLock()
	defer service.mu.RUnlock()

	for _, item := range service.items {
		if item.ID == id {
			return item, true
		}
	}

	return model.Image{}, false
}

func (service *ImageService) ReadAsset(ctx context.Context, token string, id string, assetIndex int) ([]byte, string, error) {
	item, ok := service.GetByID(id)
	if !ok {
		return nil, "", fmt.Errorf("image %s not found", id)
	}

	paths := item.AllImagePaths()
	if assetIndex < 0 || assetIndex >= len(paths) {
		return nil, "", fmt.Errorf("asset index %d out of range", assetIndex)
	}

	content, _, contentType, err := service.storage.GetFile(ctx, token, paths[assetIndex])
	return content, contentType, err
}

func (service *ImageService) bootstrap(ctx context.Context) error {
	if !service.storage.Configured() {
		service.items = []model.Image{}
		return service.writeCache()
	}

	if cachePayload, err := os.ReadFile(service.cacheFile); err == nil {
		var index model.ImageIndex
		if err := json.Unmarshal(cachePayload, &index); err == nil {
			service.items = index.Items
			return nil
		}
	}

	content, _, _, err := service.storage.GetFile(ctx, "", "index.json")
	if err != nil {
		service.items = []model.Image{}
		return service.writeCache()
	}

	var index model.ImageIndex
	if err := json.Unmarshal(content, &index); err != nil {
		return err
	}

	service.items = index.Items
	return service.writeCache()
}

func (service *ImageService) persistIndex(ctx context.Context, token string) error {
	payload, err := json.MarshalIndent(model.ImageIndex{Items: service.items}, "", "  ")
	if err != nil {
		return err
	}

	if err := service.storage.PutFile(ctx, token, "index.json", payload, "Update story index"); err != nil {
		return err
	}

	return service.writeCache()
}

func (service *ImageService) writeMetadata(ctx context.Context, token string, image model.Image) error {
	payload, err := json.MarshalIndent(image, "", "  ")
	if err != nil {
		return err
	}

	return service.storage.PutFile(ctx, token, image.MetadataPath, payload, fmt.Sprintf("Update metadata %s", image.ID))
}

func (service *ImageService) nextMetadataPath(capturedAt time.Time) string {
	year, month, day := utils.DayPathParts(capturedAt)
	prefix := filepath.ToSlash(filepath.Join(year, month, day))
	maxSequence := 0

	for _, item := range service.items {
		if !strings.HasPrefix(item.MetadataPath, prefix+"/") {
			continue
		}

		baseName := strings.TrimSuffix(filepath.Base(item.MetadataPath), filepath.Ext(item.MetadataPath))
		parts := strings.SplitN(baseName, "_", 2)
		sequence, err := strconv.Atoi(parts[0])
		if err == nil && sequence > maxSequence {
			maxSequence = sequence
		}
	}

	next := strconv.Itoa(maxSequence + 1)
	return filepath.ToSlash(filepath.Join(prefix, next+".json"))
}

func (service *ImageService) nextImagePath(capturedAt time.Time, fileIndex int) string {
	year, month, day := utils.DayPathParts(capturedAt)
	prefix := filepath.ToSlash(filepath.Join(year, month, day))

	// Use timestamp-based unique naming to avoid collisions
	ts := time.Now().UnixMilli()
	return filepath.ToSlash(filepath.Join(prefix, fmt.Sprintf("%d_%d.webp", ts, fileIndex)))
}

func (service *ImageService) writeCache() error {
	if err := os.MkdirAll(filepath.Dir(service.cacheFile), 0o755); err != nil {
		return err
	}

	payload, err := json.MarshalIndent(model.ImageIndex{Items: service.items}, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(service.cacheFile, payload, 0o644)
}