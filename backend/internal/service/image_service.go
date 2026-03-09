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
	storage      *storage.GitHubStorage
	repoName     string
	adminLogin   string
	defaultToken string
	cacheFile    string
	mu           sync.RWMutex
	userItems    map[string][]model.Image // login -> items
}

func NewImageService(ctx context.Context, store *storage.GitHubStorage, repoName string, adminLogin string, defaultToken string, cacheFile string) (*ImageService, error) {
	service := &ImageService{
		storage:      store,
		repoName:     repoName,
		adminLogin:   adminLogin,
		defaultToken: defaultToken,
		cacheFile:    cacheFile,
		userItems:    map[string][]model.Image{},
	}
	if err := service.bootstrapAdmin(ctx); err != nil {
		return nil, err
	}

	return service, nil
}

// GetFeed returns aggregated posts from multiple users, sorted by startAt desc.
func (service *ImageService) GetFeed(ctx context.Context, token string, feedLogins []string) []model.Image {
	// Always include admin
	logins := uniqueStrings(append(feedLogins, service.adminLogin))

	var all []model.Image
	for _, login := range logins {
		items := service.loadUser(ctx, token, login)
		all = append(all, items...)
	}

	sort.Slice(all, func(i, j int) bool {
		return all[i].SortTime().After(all[j].SortTime())
	})

	return all
}

// GetUserItems returns items for a single user (from cache or fetched).
func (service *ImageService) GetUserItems(ctx context.Context, token string, login string) []model.Image {
	return service.loadUser(ctx, token, login)
}

func (service *ImageService) Create(ctx context.Context, token string, author model.GitHubUser, description string, timeMode string, startAt time.Time, endAt time.Time, files [][]byte) (model.Image, error) {
	ownerLogin := author.Login

	// Ensure their data is loaded
	service.loadUser(ctx, token, ownerLogin)

	service.mu.Lock()
	defer service.mu.Unlock()

	now := utils.NowBeijing()
	items := service.userItems[ownerLogin]
	metadataPath := nextMetadataPath(items, startAt)
	var imagePaths []string
	for i, file := range files {
		imagePaths = append(imagePaths, nextImagePath(startAt, i))
		if err := service.storage.PutFile(ctx, token, ownerLogin, service.repoName, imagePaths[i], file, fmt.Sprintf("Add image %d for post", i+1)); err != nil {
			return model.Image{}, err
		}
	}

	image := model.Image{
		ID:           utils.NewID(),
		AuthorLogin:  author.Login,
		AuthorAvatar: author.AvatarURL,
		Description:  description,
		TimeMode:     timeMode,
		StartAt:      startAt,
		EndAt:        endAt,
		CapturedAt:   startAt,
		ImagePaths:   imagePaths,
		MetadataPath: metadataPath,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	image.NormalizeTimeFields()

	if err := service.writeMetadata(ctx, token, ownerLogin, image); err != nil {
		return model.Image{}, err
	}

	service.userItems[ownerLogin] = append(service.userItems[ownerLogin], image)
	if err := service.persistIndex(ctx, token, ownerLogin); err != nil {
		return model.Image{}, err
	}

	return image, nil
}

func (service *ImageService) Update(ctx context.Context, token string, ownerLogin string, id string, description string, timeMode string, startAt time.Time, endAt time.Time, files [][]byte) (model.Image, error) {
	service.mu.Lock()
	defer service.mu.Unlock()

	items := service.userItems[ownerLogin]
	index := -1
	for currentIndex, item := range items {
		if item.ID == id {
			index = currentIndex
			break
		}
	}
	if index == -1 {
		return model.Image{}, fmt.Errorf("image %s not found", id)
	}

	current := items[index]
	current.NormalizeTimeFields()
	updated := current
	updated.Description = description
	updated.TimeMode = timeMode
	updated.StartAt = startAt
	updated.EndAt = endAt
	updated.CapturedAt = startAt
	updated.UpdatedAt = utils.NowBeijing()
	updated.NormalizeTimeFields()

	if len(files) > 0 {
		var newPaths []string
		for i, file := range files {
			p := nextImagePath(startAt, i)
			newPaths = append(newPaths, p)
			if err := service.storage.PutFile(ctx, token, ownerLogin, service.repoName, p, file, fmt.Sprintf("Update image %d for %s", i+1, id)); err != nil {
				return model.Image{}, err
			}
		}
		for _, oldPath := range current.AllImagePaths() {
			_ = service.storage.DeleteFile(ctx, token, ownerLogin, service.repoName, oldPath, fmt.Sprintf("Remove old image %s", id))
		}
		updated.ImagePaths = newPaths
		updated.ImagePath = ""
	} else {
		moved := !utils.SameBeijingDay(current.SortTime(), startAt)
		if moved {
			oldPaths := current.AllImagePaths()
			var newPaths []string
			for i, oldPath := range oldPaths {
				existingImage, _, _, err := service.storage.GetFile(ctx, token, ownerLogin, service.repoName, oldPath)
				if err != nil {
					return model.Image{}, err
				}
				newPath := nextImagePath(startAt, i)
				newPaths = append(newPaths, newPath)
				if err := service.storage.PutFile(ctx, token, ownerLogin, service.repoName, newPath, existingImage, fmt.Sprintf("Move image %s", id)); err != nil {
					return model.Image{}, err
				}
			}
			for _, oldPath := range oldPaths {
				_ = service.storage.DeleteFile(ctx, token, ownerLogin, service.repoName, oldPath, fmt.Sprintf("Remove old image %s", id))
			}
			updated.ImagePaths = newPaths
			updated.ImagePath = ""
		}
	}

	newMetadataPath := nextMetadataPath(items, startAt)
	if newMetadataPath != current.MetadataPath {
		_ = service.storage.DeleteFile(ctx, token, ownerLogin, service.repoName, current.MetadataPath, fmt.Sprintf("Remove old metadata %s", id))
	}
	updated.MetadataPath = newMetadataPath

	if err := service.writeMetadata(ctx, token, ownerLogin, updated); err != nil {
		return model.Image{}, err
	}

	service.userItems[ownerLogin][index] = updated
	if err := service.persistIndex(ctx, token, ownerLogin); err != nil {
		return model.Image{}, err
	}

	return updated, nil
}

func (service *ImageService) Delete(ctx context.Context, token string, ownerLogin string, id string) error {
	service.mu.Lock()
	defer service.mu.Unlock()

	items := service.userItems[ownerLogin]
	index := -1
	for currentIndex, item := range items {
		if item.ID == id {
			index = currentIndex
			break
		}
	}
	if index == -1 {
		return fmt.Errorf("image %s not found", id)
	}

	item := items[index]
	for _, imgPath := range item.AllImagePaths() {
		if err := service.storage.DeleteFile(ctx, token, ownerLogin, service.repoName, imgPath, fmt.Sprintf("Delete image %s", item.ID)); err != nil {
			return err
		}
	}
	if err := service.storage.DeleteFile(ctx, token, ownerLogin, service.repoName, item.MetadataPath, fmt.Sprintf("Delete metadata %s", item.ID)); err != nil {
		return err
	}

	service.userItems[ownerLogin] = append(items[:index], items[index+1:]...)
	return service.persistIndex(ctx, token, ownerLogin)
}

// FindImage looks up an image by owner and ID.
func (service *ImageService) FindImage(ownerLogin string, id string) (model.Image, bool) {
	service.mu.RLock()
	defer service.mu.RUnlock()

	for _, item := range service.userItems[ownerLogin] {
		if item.ID == id {
			return item, true
		}
	}

	return model.Image{}, false
}

func (service *ImageService) ReadAsset(ctx context.Context, token string, ownerLogin string, id string, assetIndex int) ([]byte, string, error) {
	item, ok := service.FindImage(ownerLogin, id)
	if !ok {
		return nil, "", fmt.Errorf("image %s not found", id)
	}

	paths := item.AllImagePaths()
	if assetIndex < 0 || assetIndex >= len(paths) {
		return nil, "", fmt.Errorf("asset index %d out of range", assetIndex)
	}

	readToken := token
	if readToken == "" {
		readToken = service.defaultToken
	}

	content, _, contentType, err := service.storage.GetFile(ctx, readToken, ownerLogin, service.repoName, paths[assetIndex])
	return content, contentType, err
}

// loadUser loads a user's items if not cached, returns cached items.
func (service *ImageService) loadUser(ctx context.Context, token string, login string) []model.Image {
	service.mu.RLock()
	items, ok := service.userItems[login]
	service.mu.RUnlock()

	if ok {
		return append([]model.Image(nil), items...)
	}

	readToken := token
	if readToken == "" {
		readToken = service.defaultToken
	}

	content, _, _, err := service.storage.GetFile(ctx, readToken, login, service.repoName, "index.json")
	if err != nil {
		service.mu.Lock()
		service.userItems[login] = []model.Image{}
		service.mu.Unlock()
		return nil
	}

	var idx model.ImageIndex
	if err := json.Unmarshal(content, &idx); err != nil {
		service.mu.Lock()
		service.userItems[login] = []model.Image{}
		service.mu.Unlock()
		return nil
	}

	// Ensure AuthorLogin is set on all items
	for i := range idx.Items {
		if idx.Items[i].AuthorLogin == "" {
			idx.Items[i].AuthorLogin = login
		}
		idx.Items[i].NormalizeTimeFields()
	}

	service.mu.Lock()
	service.userItems[login] = idx.Items
	service.mu.Unlock()

	return append([]model.Image(nil), idx.Items...)
}

func (service *ImageService) bootstrapAdmin(ctx context.Context) error {
	if service.adminLogin == "" {
		return nil
	}

	// Try loading from cache file first
	if cachePayload, err := os.ReadFile(service.cacheFile); err == nil {
		var index model.ImageIndex
		if err := json.Unmarshal(cachePayload, &index); err == nil {
			for i := range index.Items {
				if index.Items[i].AuthorLogin == "" {
					index.Items[i].AuthorLogin = service.adminLogin
				}
				index.Items[i].NormalizeTimeFields()
			}
			service.userItems[service.adminLogin] = index.Items
			return nil
		}
	}

	// Fetch from GitHub
	content, _, _, err := service.storage.GetFile(ctx, service.defaultToken, service.adminLogin, service.repoName, "index.json")
	if err != nil {
		service.userItems[service.adminLogin] = []model.Image{}
		return service.writeCache(service.adminLogin)
	}

	var index model.ImageIndex
	if err := json.Unmarshal(content, &index); err != nil {
		return err
	}

	for i := range index.Items {
		if index.Items[i].AuthorLogin == "" {
			index.Items[i].AuthorLogin = service.adminLogin
		}
		index.Items[i].NormalizeTimeFields()
	}

	service.userItems[service.adminLogin] = index.Items
	return service.writeCache(service.adminLogin)
}

func (service *ImageService) persistIndex(ctx context.Context, token string, ownerLogin string) error {
	items := service.userItems[ownerLogin]
	payload, err := json.MarshalIndent(model.ImageIndex{Items: items}, "", "  ")
	if err != nil {
		return err
	}

	if err := service.storage.PutFile(ctx, token, ownerLogin, service.repoName, "index.json", payload, "Update story index"); err != nil {
		return err
	}

	return service.writeCache(ownerLogin)
}

func (service *ImageService) writeMetadata(ctx context.Context, token string, ownerLogin string, image model.Image) error {
	payload, err := json.MarshalIndent(image, "", "  ")
	if err != nil {
		return err
	}

	return service.storage.PutFile(ctx, token, ownerLogin, service.repoName, image.MetadataPath, payload, fmt.Sprintf("Update metadata %s", image.ID))
}

func (service *ImageService) writeCache(ownerLogin string) error {
	if ownerLogin != service.adminLogin {
		return nil
	}

	items := service.userItems[ownerLogin]
	if err := os.MkdirAll(filepath.Dir(service.cacheFile), 0o755); err != nil {
		return err
	}

	payload, err := json.MarshalIndent(model.ImageIndex{Items: items}, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(service.cacheFile, payload, 0o644)
}

func nextMetadataPath(items []model.Image, capturedAt time.Time) string {
	year, month, day := utils.DayPathParts(capturedAt)
	prefix := filepath.ToSlash(filepath.Join(year, month, day))
	maxSequence := 0

	for _, item := range items {
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

func nextImagePath(capturedAt time.Time, fileIndex int) string {
	year, month, day := utils.DayPathParts(capturedAt)
	prefix := filepath.ToSlash(filepath.Join(year, month, day))
	ts := time.Now().UnixMilli()
	return filepath.ToSlash(filepath.Join(prefix, fmt.Sprintf("%d_%d.webp", ts, fileIndex)))
}

func uniqueStrings(input []string) []string {
	seen := map[string]struct{}{}
	var result []string
	for _, s := range input {
		lower := strings.ToLower(s)
		if _, ok := seen[lower]; ok {
			continue
		}
		seen[lower] = struct{}{}
		result = append(result, s)
	}
	return result
}