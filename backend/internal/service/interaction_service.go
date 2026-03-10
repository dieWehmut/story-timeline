package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
	"github.com/dieWehmut/story-timeline/backend/internal/utils"
)

type InteractionService struct {
	database *storage.SupabaseStorage
	assets   *storage.CloudinaryStorage
}

func NewInteractionService(database *storage.SupabaseStorage, assets *storage.CloudinaryStorage) *InteractionService {
	return &InteractionService{database: database, assets: assets}
}

func (service *InteractionService) ToggleLike(ctx context.Context, _ string, ownerLogin string, postID string, user model.GitHubUser) (*model.LikeFile, error) {
	likes, err := service.database.ListLikes(ctx, ownerLogin, postID)
	if err != nil {
		return nil, err
	}

	alreadyLiked := false
	for _, like := range likes.Likes {
		if strings.EqualFold(like.Login, user.Login) {
			alreadyLiked = true
			break
		}
	}

	if alreadyLiked {
		if err := service.database.DeleteLike(ctx, ownerLogin, postID, user.Login); err != nil {
			return nil, err
		}
	} else {
		if err := service.database.UpsertLike(ctx, ownerLogin, postID, model.Like{
			Login:     user.Login,
			AvatarURL: user.AvatarURL,
			LikedAt:   utils.NowBeijing(),
		}); err != nil {
			return nil, err
		}
	}

	return service.database.ListLikes(ctx, ownerLogin, postID)
}

func (service *InteractionService) GetLikes(ctx context.Context, _ string, ownerLogin, postID string) *model.LikeFile {
	likes, err := service.database.ListLikes(ctx, ownerLogin, postID)
	if err != nil {
		return &model.LikeFile{}
	}
	return likes
}

func commentImagePath(commenterLogin, postOwner, postID, commentID string, assetIndex int) string {
	return fmt.Sprintf("comments/%s/%s/%s/%s/%d", commenterLogin, postOwner, postID, commentID, assetIndex)
}

func (service *InteractionService) AddComment(ctx context.Context, _ string, commenter model.GitHubUser, postOwner, postID, text string, imageData [][]byte) (model.Comment, error) {
	commentID := utils.NewID()
	imagePaths := make([]string, 0, len(imageData))
	for assetIndex, data := range imageData {
		objectKey := commentImagePath(commenter.Login, postOwner, postID, commentID, assetIndex)
		if err := service.assets.PutObject(ctx, objectKey, data, "image/webp"); err != nil {
			return model.Comment{}, err
		}
		imagePaths = append(imagePaths, objectKey)
	}

	comment := model.Comment{
		ID:           commentID,
		PostOwner:    postOwner,
		PostID:       postID,
		AuthorLogin:  commenter.Login,
		AuthorAvatar: commenter.AvatarURL,
		Text:         text,
		ImagePaths:   imagePaths,
		CreatedAt:    utils.NowBeijing(),
	}
	if len(imagePaths) == 1 {
		comment.ImagePath = imagePaths[0]
	}

	if err := service.database.AddComment(ctx, comment); err != nil {
		return model.Comment{}, err
	}

	return comment, nil
}

func (service *InteractionService) GetAllComments(ctx context.Context, _ string, postOwner, postID string, feedLogins []string) []CommentWithAuthor {
	comments, err := service.database.ListComments(ctx, postOwner, postID, uniqueStrings(feedLogins))
	if err != nil {
		return []CommentWithAuthor{}
	}

	result := make([]CommentWithAuthor, 0, len(comments))
	for _, comment := range comments {
		result = append(result, CommentWithAuthor{Comment: comment, AuthorLogin: comment.AuthorLogin})
	}
	return result
}

type CommentWithAuthor struct {
	model.Comment
	AuthorLogin string `json:"authorLogin"`
}

func (service *InteractionService) GetPostInteractionCounts(ctx context.Context, token, ownerLogin, postID string, feedLogins []string) (int, int) {
	likes := service.GetLikes(ctx, token, ownerLogin, postID)
	comments := service.GetAllComments(ctx, token, ownerLogin, postID, feedLogins)
	return len(likes.Likes), len(comments)
}

func (service *InteractionService) DeleteComment(ctx context.Context, _ string, caller model.GitHubUser, commenterLogin, postOwner, postID, commentID string) error {
	callerIsCommenter := strings.EqualFold(caller.Login, commenterLogin)
	callerIsPostOwner := strings.EqualFold(caller.Login, postOwner)
	if !callerIsCommenter && !callerIsPostOwner {
		return fmt.Errorf("no permission to delete this comment")
	}

	if callerIsCommenter {
		return service.database.SetCommentDeleted(ctx, commenterLogin, postOwner, postID, commentID)
	}
	return service.database.SetCommentHidden(ctx, postOwner, postID, commentID)
}

func (service *InteractionService) IsLikedBy(ctx context.Context, token, ownerLogin, postID, userLogin string) bool {
	likes := service.GetLikes(ctx, token, ownerLogin, postID)
	for _, like := range likes.Likes {
		if strings.EqualFold(like.Login, userLogin) {
			return true
		}
	}
	return false
}

func (service *InteractionService) ReadCommentImage(ctx context.Context, commenterLogin, postOwner, postID, commentID string, assetIndex int) ([]byte, string, error) {
	comment, err := service.database.GetComment(ctx, commenterLogin, postOwner, postID, commentID)
	if err != nil {
		return nil, "", err
	}

	paths := comment.AllImagePaths()
	if assetIndex < 0 || assetIndex >= len(paths) {
		return nil, "", fmt.Errorf("asset index %d out of range", assetIndex)
	}

	return service.assets.GetObject(ctx, paths[assetIndex])
}
