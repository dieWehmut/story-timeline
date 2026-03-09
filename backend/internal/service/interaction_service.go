package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

// InteractionService manages likes (in post-owner's repo) and comments (in commenter's repo).
type InteractionService struct {
	storage      *storage.GitHubStorage
	repoName     string
	defaultToken string

	mu        sync.RWMutex
	likeCache map[string]*model.LikeFile    // key: "ownerLogin/postID"
	cmtCache  map[string]*model.CommentFile // key: "commenterLogin/postOwner/postID"
}

func NewInteractionService(store *storage.GitHubStorage, repoName string, defaultToken string) *InteractionService {
	return &InteractionService{
		storage:      store,
		repoName:     repoName,
		defaultToken: defaultToken,
		likeCache:    map[string]*model.LikeFile{},
		cmtCache:     map[string]*model.CommentFile{},
	}
}

// --- Likes (stored in post owner's repo) ---

func likePath(postID string) string {
	return fmt.Sprintf("likes/%s.json", postID)
}

func likeKey(ownerLogin, postID string) string {
	return ownerLogin + "/" + postID
}

func (s *InteractionService) loadLikes(ctx context.Context, token, ownerLogin, postID string) *model.LikeFile {
	key := likeKey(ownerLogin, postID)

	s.mu.RLock()
	cached, ok := s.likeCache[key]
	s.mu.RUnlock()
	if ok {
		return cached
	}

	readToken := token
	if readToken == "" {
		readToken = s.defaultToken
	}

	content, _, _, err := s.storage.GetFile(ctx, readToken, ownerLogin, s.repoName, likePath(postID))
	if err != nil {
		lf := &model.LikeFile{}
		s.mu.Lock()
		s.likeCache[key] = lf
		s.mu.Unlock()
		return lf
	}

	var lf model.LikeFile
	if err := json.Unmarshal(content, &lf); err != nil {
		lf = model.LikeFile{}
	}

	s.mu.Lock()
	s.likeCache[key] = &lf
	s.mu.Unlock()
	return &lf
}

func (s *InteractionService) persistLikes(ctx context.Context, token, ownerLogin, postID string, lf *model.LikeFile) error {
	payload, err := json.MarshalIndent(lf, "", "  ")
	if err != nil {
		return err
	}
	return s.storage.PutFile(ctx, token, ownerLogin, s.repoName, likePath(postID), payload, fmt.Sprintf("Update likes for %s", postID))
}

// ToggleLike adds or removes a like. Returns the updated like file.
func (s *InteractionService) ToggleLike(ctx context.Context, token string, ownerLogin string, postID string, user model.GitHubUser) (*model.LikeFile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := likeKey(ownerLogin, postID)
	lf, ok := s.likeCache[key]
	if !ok {
		// load without lock
		s.mu.Unlock()
		lf = s.loadLikes(ctx, token, ownerLogin, postID)
		s.mu.Lock()
	}

	// Check if already liked
	idx := -1
	for i, l := range lf.Likes {
		if strings.EqualFold(l.Login, user.Login) {
			idx = i
			break
		}
	}

	if idx >= 0 {
		// Unlike
		lf.Likes = append(lf.Likes[:idx], lf.Likes[idx+1:]...)
	} else {
		// Like
		lf.Likes = append(lf.Likes, model.Like{
			Login:     user.Login,
			AvatarURL: user.AvatarURL,
			LikedAt:   utils.NowBeijing(),
		})
	}

	// Use the post owner's token to write likes to their repo.
	// For simplicity, we use the liker's token — the repo is public
	// but writes need push access. For now we use the liker's token
	// to write to the owner's repo. This only works if the repo allows it.
	// Actually, likes must be written by someone with push access.
	// Design choice: use defaultToken (admin's token) to write likes to any user's repo.
	writeToken := s.defaultToken
	if strings.EqualFold(ownerLogin, user.Login) {
		writeToken = token
	}

	if err := s.persistLikes(ctx, writeToken, ownerLogin, postID, lf); err != nil {
		return nil, err
	}

	s.likeCache[key] = lf
	return lf, nil
}

// GetLikes returns the like file for a post.
func (s *InteractionService) GetLikes(ctx context.Context, token, ownerLogin, postID string) *model.LikeFile {
	return s.loadLikes(ctx, token, ownerLogin, postID)
}

// --- Comments (stored in commenter's repo) ---

func commentPath(postOwner, postID string) string {
	return fmt.Sprintf("comments/%s/%s.json", postOwner, postID)
}

func cmtKey(commenterLogin, postOwner, postID string) string {
	return commenterLogin + "/" + postOwner + "/" + postID
}

func (s *InteractionService) loadComments(ctx context.Context, token, commenterLogin, postOwner, postID string) *model.CommentFile {
	key := cmtKey(commenterLogin, postOwner, postID)

	s.mu.RLock()
	cached, ok := s.cmtCache[key]
	s.mu.RUnlock()
	if ok {
		return cached
	}

	readToken := token
	if readToken == "" {
		readToken = s.defaultToken
	}

	content, _, _, err := s.storage.GetFile(ctx, readToken, commenterLogin, s.repoName, commentPath(postOwner, postID))
	if err != nil {
		cf := &model.CommentFile{}
		s.mu.Lock()
		s.cmtCache[key] = cf
		s.mu.Unlock()
		return cf
	}

	var cf model.CommentFile
	if err := json.Unmarshal(content, &cf); err != nil {
		cf = model.CommentFile{}
	}

	s.mu.Lock()
	s.cmtCache[key] = &cf
	s.mu.Unlock()
	return &cf
}

func (s *InteractionService) persistComments(ctx context.Context, token, commenterLogin, postOwner, postID string, cf *model.CommentFile) error {
	payload, err := json.MarshalIndent(cf, "", "  ")
	if err != nil {
		return err
	}
	return s.storage.PutFile(ctx, token, commenterLogin, s.repoName, commentPath(postOwner, postID), payload,
		fmt.Sprintf("Update comments on %s/%s", postOwner, postID))
}

// AddComment adds a comment stored in the commenter's repo.
func (s *InteractionService) AddComment(ctx context.Context, token string, commenter model.GitHubUser, postOwner, postID, text string, imageData []byte) (model.Comment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := cmtKey(commenter.Login, postOwner, postID)
	cf, ok := s.cmtCache[key]
	if !ok {
		s.mu.Unlock()
		cf = s.loadComments(ctx, token, commenter.Login, postOwner, postID)
		s.mu.Lock()
	}

	commentID := utils.NewID()
	var imagePath string
	if len(imageData) > 0 {
		imagePath = fmt.Sprintf("comment-images/%s/%s/%s.webp", postOwner, postID, commentID)
		if err := s.storage.PutFile(ctx, token, commenter.Login, s.repoName, imagePath, imageData, "Add comment image"); err != nil {
			return model.Comment{}, err
		}
	}

	comment := model.Comment{
		ID:        commentID,
		PostOwner: postOwner,
		PostID:    postID,
		Text:      text,
		ImagePath: imagePath,
		CreatedAt: utils.NowBeijing(),
	}

	cf.Comments = append(cf.Comments, comment)

	if err := s.persistComments(ctx, token, commenter.Login, postOwner, postID, cf); err != nil {
		return model.Comment{}, err
	}

	s.cmtCache[key] = cf
	return comment, nil
}

// GetAllComments aggregates comments for a post from multiple users.
func (s *InteractionService) GetAllComments(ctx context.Context, token string, postOwner, postID string, feedLogins []string) []CommentWithAuthor {
	var result []CommentWithAuthor

	for _, login := range feedLogins {
		cf := s.loadComments(ctx, token, login, postOwner, postID)
		for _, c := range cf.Comments {
			result = append(result, CommentWithAuthor{
				Comment:     c,
				AuthorLogin: login,
			})
		}
	}

	// Sort by createdAt ascending
	for i := 1; i < len(result); i++ {
		for j := i; j > 0 && result[j].CreatedAt.Before(result[j-1].CreatedAt); j-- {
			result[j], result[j-1] = result[j-1], result[j]
		}
	}

	return result
}

// CommentWithAuthor includes the commenter login alongside the comment.
type CommentWithAuthor struct {
	model.Comment
	AuthorLogin string `json:"authorLogin"`
}

// GetPostInteractionCounts returns like count and comment count for a post.
// feedLogins should include all visible users for comment aggregation.
func (s *InteractionService) GetPostInteractionCounts(ctx context.Context, token, ownerLogin, postID string, feedLogins []string) (int, int) {
	lf := s.loadLikes(ctx, token, ownerLogin, postID)
	likeCount := len(lf.Likes)

	commentCount := 0
	for _, login := range feedLogins {
		cf := s.loadComments(ctx, token, login, ownerLogin, postID)
		commentCount += len(cf.Comments)
	}

	return likeCount, commentCount
}

// IsLikedBy checks if a user has liked a post.
func (s *InteractionService) IsLikedBy(ctx context.Context, token, ownerLogin, postID, userLogin string) bool {
	lf := s.loadLikes(ctx, token, ownerLogin, postID)
	for _, l := range lf.Likes {
		if strings.EqualFold(l.Login, userLogin) {
			return true
		}
	}
	return false
}

// ReadCommentImage reads a comment image from the commenter's repo.
func (s *InteractionService) ReadCommentImage(ctx context.Context, commenterLogin, postOwner, postID, commentID string) ([]byte, string, error) {
	imagePath := fmt.Sprintf("comment-images/%s/%s/%s.webp", postOwner, postID, commentID)
	content, _, contentType, err := s.storage.GetFile(ctx, s.defaultToken, commenterLogin, s.repoName, imagePath)
	if err != nil {
		return nil, "", err
	}
	return content, contentType, nil
}
