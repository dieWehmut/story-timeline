package service

import (
	"context"
	"strings"
	"sync"
	"time"

	githubclient "github.com/dieWehmut/story-timeline/backend/internal/github"
	"github.com/dieWehmut/story-timeline/backend/internal/model"
)

type UserService struct {
	graphql    *githubclient.GraphQLClient
	repoName   string
	branch     string
	adminLogin string

	mu          sync.RWMutex
	followCache map[string]*followEntry
	repoCache   map[string]*repoEntry
	allUsers    *followEntry
}

type followEntry struct {
	users    []model.GitHubUser
	loadedAt time.Time
}

type repoEntry struct {
	exists   bool
	checkedAt time.Time
}

const followCacheTTL = 5 * time.Minute
const repoCacheTTL = 5 * time.Minute

func NewUserService(graphql *githubclient.GraphQLClient, repoName string, branch string, adminLogin string) *UserService {
	return &UserService{
		graphql:     graphql,
		repoName:    repoName,
		branch:      branch,
		adminLogin:  adminLogin,
		followCache: map[string]*followEntry{},
		repoCache:   map[string]*repoEntry{},
	}
}

func (s *UserService) GetAllFeedUsers(ctx context.Context, token string) ([]model.GitHubUser, error) {
	s.mu.RLock()
	entry := s.allUsers
	s.mu.RUnlock()

	if entry != nil && time.Since(entry.loadedAt) < followCacheTTL {
		return entry.users, nil
	}

	users, err := s.graphql.SearchRepoOwners(ctx, token, s.repoName)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.allUsers = &followEntry{users: users, loadedAt: time.Now()}
	s.mu.Unlock()

	return users, nil
}

// GetFollowing returns the list of users the viewer follows (cached).
func (s *UserService) GetFollowing(ctx context.Context, token string, viewerLogin string) ([]model.GitHubUser, error) {
	s.mu.RLock()
	entry, ok := s.followCache[viewerLogin]
	s.mu.RUnlock()

	if ok && time.Since(entry.loadedAt) < followCacheTTL {
		return entry.users, nil
	}

	users, err := s.graphql.FetchFollowing(ctx, token)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.followCache[viewerLogin] = &followEntry{users: users, loadedAt: time.Now()}
	s.mu.Unlock()

	return users, nil
}

// HasRepo returns true if the user has a story-timeline-data repository (cached).
func (s *UserService) HasRepo(ctx context.Context, token string, login string) (bool, error) {
	s.mu.RLock()
	entry, ok := s.repoCache[login]
	s.mu.RUnlock()

	if ok && time.Since(entry.checkedAt) < repoCacheTTL {
		return entry.exists, nil
	}

	exists, err := s.graphql.CheckRepo(ctx, token, login, s.repoName)
	if err != nil {
		return false, err
	}

	s.mu.Lock()
	s.repoCache[login] = &repoEntry{exists: exists, checkedAt: time.Now()}
	s.mu.Unlock()

	return exists, nil
}

// EnsureRepo checks if the user has a story-timeline-data repository and creates one if not.
func (s *UserService) EnsureRepo(ctx context.Context, token string, login string) error {
	exists, err := s.HasRepo(ctx, token, login)
	if err != nil {
		return err
	}

	if exists {
		return nil
	}

	if err := s.graphql.CreateRepo(ctx, token, s.repoName); err != nil {
		return err
	}

	if err := s.graphql.InitializeRepo(ctx, token, login, s.repoName, s.branch); err != nil {
		return err
	}

	s.mu.Lock()
	s.repoCache[login] = &repoEntry{exists: true, checkedAt: time.Now()}
	s.allUsers = nil
	s.mu.Unlock()

	return nil
}

// GetFeedUsers returns the list of users whose posts should be visible to the viewer.
// Always includes admin. For authenticated users, also includes followed users with repos.
func (s *UserService) GetFeedUsers(ctx context.Context, token string, viewerLogin string) ([]model.GitHubUser, error) {
	var result []model.GitHubUser

	if token == "" || viewerLogin == "" {
		return result, nil
	}

	if s.adminLogin != "" && strings.EqualFold(viewerLogin, s.adminLogin) {
		return s.GetAllFeedUsers(ctx, token)
	}

	following, err := s.GetFollowing(ctx, token, viewerLogin)
	if err != nil {
		return nil, err
	}

	for _, user := range following {
		has, err := s.HasRepo(ctx, token, user.Login)
		if err != nil {
			continue
		}
		if has {
			result = append(result, user)
		}
	}

	return result, nil
}

func (s *UserService) AdminLogin() string {
	return s.adminLogin
}

func (s *UserService) RepoName() string {
	return s.repoName
}
