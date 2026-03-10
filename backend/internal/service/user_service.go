package service

import (
	"context"
	"strings"
	"sync"
	"time"

	githubclient "github.com/dieWehmut/story-timeline/backend/internal/github"
	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

type UserService struct {
	graphql    *githubclient.GraphQLClient
	database   *storage.SupabaseStorage
	adminLogin string

	mu          sync.RWMutex
	followCache map[string]*followEntry
	allUsers    *followEntry
}

type followEntry struct {
	users    []model.GitHubUser
	loadedAt time.Time
}

const followCacheTTL = 5 * time.Minute

func NewUserService(graphql *githubclient.GraphQLClient, database *storage.SupabaseStorage, adminLogin string) *UserService {
	return &UserService{
		graphql:     graphql,
		database:    database,
		adminLogin:  adminLogin,
		followCache: map[string]*followEntry{},
	}
}

func (service *UserService) GetAllFeedUsers(ctx context.Context, _ string) ([]model.GitHubUser, error) {
	service.mu.RLock()
	entry := service.allUsers
	service.mu.RUnlock()

	if entry != nil && time.Since(entry.loadedAt) < followCacheTTL {
		return entry.users, nil
	}

	users, err := service.database.ListActiveAuthors(ctx)
	if err != nil {
		return nil, err
	}

	service.mu.Lock()
	service.allUsers = &followEntry{users: users, loadedAt: time.Now()}
	service.mu.Unlock()
	return users, nil
}

func (service *UserService) GetFollowing(ctx context.Context, token string, viewerLogin string) ([]model.GitHubUser, error) {
	service.mu.RLock()
	entry, ok := service.followCache[viewerLogin]
	service.mu.RUnlock()

	if ok && time.Since(entry.loadedAt) < followCacheTTL {
		return entry.users, nil
	}

	users, err := service.graphql.FetchFollowing(ctx, token)
	if err != nil {
		return nil, err
	}

	service.mu.Lock()
	service.followCache[viewerLogin] = &followEntry{users: users, loadedAt: time.Now()}
	service.mu.Unlock()
	return users, nil
}

func (service *UserService) GetFeedUsers(ctx context.Context, token string, viewerLogin string) ([]model.GitHubUser, error) {
	if token == "" || viewerLogin == "" {
		return []model.GitHubUser{}, nil
	}

	activeUsers, err := service.GetAllFeedUsers(ctx, token)
	if err != nil {
		return nil, err
	}

	if service.adminLogin != "" && strings.EqualFold(viewerLogin, service.adminLogin) {
		return activeUsers, nil
	}

	activeByLogin := make(map[string]model.GitHubUser, len(activeUsers))
	for _, user := range activeUsers {
		activeByLogin[strings.ToLower(user.Login)] = user
	}

	following, err := service.GetFollowing(ctx, token, viewerLogin)
	if err != nil {
		return nil, err
	}

	result := make([]model.GitHubUser, 0, len(following))
	for _, user := range following {
		if active, ok := activeByLogin[strings.ToLower(user.Login)]; ok {
			if active.AvatarURL == "" {
				active.AvatarURL = user.AvatarURL
			}
			result = append(result, active)
		}
	}
	return result, nil
}

func (service *UserService) AdminLogin() string {
	return service.adminLogin
}
