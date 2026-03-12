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

func (service *UserService) GetFollowing(ctx context.Context, viewerLogin string) ([]model.GitHubUser, error) {
	followingLogins, err := service.database.ListFollowing(ctx, viewerLogin)
	if err != nil {
		return nil, err
	}

	return service.database.GetUsersByLogins(ctx, followingLogins)
}

func (service *UserService) GetFollowers(ctx context.Context, userLogin string) ([]model.GitHubUser, error) {
	followerLogins, err := service.database.ListFollowers(ctx, userLogin)
	if err != nil {
		return nil, err
	}

	return service.database.GetUsersByLogins(ctx, followerLogins)
}

func (service *UserService) FollowUser(ctx context.Context, followerLogin string, followingLogin string) error {
	return service.database.FollowUser(ctx, followerLogin, followingLogin)
}

func (service *UserService) UnfollowUser(ctx context.Context, followerLogin string, followingLogin string) error {
	return service.database.UnfollowUser(ctx, followerLogin, followingLogin)
}

func (service *UserService) UpsertUser(ctx context.Context, user model.AuthUser) error {
	if strings.TrimSpace(user.Login) == "" {
		return nil
	}
	return service.database.UpsertUser(ctx, user)
}

func (service *UserService) CountUsers(ctx context.Context) (int, error) {
	return service.database.CountUsers(ctx)
}

func (service *UserService) GetFeedUsers(ctx context.Context, viewerLogin string) ([]model.GitHubUser, error) {
	if viewerLogin == "" {
		return []model.GitHubUser{}, nil
	}

	activeUsers, err := service.GetAllFeedUsers(ctx, "")
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

	following, err := service.GetFollowing(ctx, viewerLogin)
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

// SyncGitHubFollows mirrors GitHub follow relationships into the app follow table
// for users who are active in this app (i.e., have content).
func (service *UserService) SyncGitHubFollows(ctx context.Context, token string, viewerLogin string) error {
	if strings.TrimSpace(token) == "" || strings.TrimSpace(viewerLogin) == "" {
		return nil
	}

	activeUsers, err := service.GetAllFeedUsers(ctx, "")
	if err != nil {
		return err
	}

	activeByLogin := make(map[string]model.GitHubUser, len(activeUsers))
	for _, user := range activeUsers {
		if user.Login == "" {
			continue
		}
		activeByLogin[strings.ToLower(user.Login)] = user
	}

	following, err := service.graphql.FetchFollowing(ctx, token)
	if err != nil {
		return err
	}

	followers, err := service.graphql.FetchFollowers(ctx, token)
	if err != nil {
		return err
	}

	for _, user := range following {
		targetLogin := strings.TrimSpace(user.Login)
		if targetLogin == "" || strings.EqualFold(targetLogin, viewerLogin) {
			continue
		}
		if _, ok := activeByLogin[strings.ToLower(targetLogin)]; !ok {
			continue
		}
		_ = service.database.FollowUser(ctx, viewerLogin, targetLogin)
	}

	for _, user := range followers {
		targetLogin := strings.TrimSpace(user.Login)
		if targetLogin == "" || strings.EqualFold(targetLogin, viewerLogin) {
			continue
		}
		if _, ok := activeByLogin[strings.ToLower(targetLogin)]; !ok {
			continue
		}
		_ = service.database.FollowUser(ctx, targetLogin, viewerLogin)
	}

	return nil
}
