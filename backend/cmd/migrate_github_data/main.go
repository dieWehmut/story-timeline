package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

type migratedPost struct {
	owner     model.GitHubUser
	image     model.Image
	hiddenIDs map[string]struct{}
}

func main() {
	ctx := context.Background()
	godotenv.Load()
	repoName := getenv("GITHUB_REPO_NAME", "story-timeline-data")
	branch := getenv("GITHUB_REPO_BRANCH", "main")
	githubToken := strings.TrimSpace(os.Getenv("GITHUB_STORAGE_TOKEN"))
	if githubToken == "" {
		log.Fatal("GITHUB_STORAGE_TOKEN is required")
	}

	supabaseStorage := storage.NewSupabaseStorage(os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	cloudinaryStorage, err := storage.NewCloudinaryStorage(storage.CloudinaryConfig{
		CloudName: os.Getenv("CLOUDINARY_CLOUD_NAME"),
		APIKey:    os.Getenv("CLOUDINARY_API_KEY"),
		APISecret: os.Getenv("CLOUDINARY_API_SECRET"),
	})
	if err != nil {
		log.Fatalf("failed to initialize Cloudinary client: %v", err)
	}


	githubStorage := storage.NewGitHubStorage(branch, githubToken)
	owners := []model.GitHubUser{
		{Login: "dieWehmut"},
		{Login: "dieSehnsucht"},
	}
	
	if len(owners) == 0 {
		log.Fatal("no legacy data repositories found")
	}

	ownerByLogin := make(map[string]model.GitHubUser, len(owners))
	posts := make(map[string]migratedPost)

	for _, owner := range owners {
		ownerByLogin[strings.ToLower(owner.Login)] = owner
		items, err := loadImageIndex(ctx, githubStorage, githubToken, owner.Login, repoName)
		log.Printf("loaded %d posts from %s", len(items), owner.Login)
		if err != nil {
			log.Printf("skip %s index: %v", owner.Login, err)
			continue
		}

		for _, item := range items {
			if item.AuthorLogin == "" {
				item.AuthorLogin = owner.Login
			}
			if item.AuthorAvatar == "" {
				item.AuthorAvatar = owner.AvatarURL
			}
			item.Tags = normalizeTags(item.Tags)

			imagePaths, err := migrateImageAssets(ctx, githubStorage, githubToken, cloudinaryStorage, owner.Login, repoName, item)
			if err != nil {
				log.Printf("skip image %s/%s assets: %v", owner.Login, item.ID, err)
				continue
			}
			if imagePaths == nil {
				imagePaths = []string{}
			}

			item.ImagePaths = imagePaths
			item.ImagePath = ""

			if err := supabaseStorage.UpsertImage(ctx, item); err != nil {
				log.Printf("skip image %s/%s upsert: %v", owner.Login, item.ID, err)
				continue
			}

			likes, err := loadLikeFile(ctx, githubStorage, githubToken, owner.Login, repoName, item.ID)
			if err != nil {
				log.Printf("likes %s/%s: %v", owner.Login, item.ID, err)
			} else {
				for _, like := range likes.Likes {
					if err := supabaseStorage.UpsertLike(ctx, owner.Login, item.ID, like); err != nil {
						log.Printf("upsert like %s/%s/%s: %v", owner.Login, item.ID, like.Login, err)
					}
				}
			}

			hiddenSet, err := loadHiddenIDs(ctx, githubStorage, githubToken, owner.Login, repoName, item.ID)
			if err != nil {
				log.Printf("hidden comments %s/%s: %v", owner.Login, item.ID, err)
				hiddenSet = map[string]struct{}{}
			}

			posts[postKey(owner.Login, item.ID)] = migratedPost{
				owner:     owner,
				image:     item,
				hiddenIDs: hiddenSet,
			}
		}
	}

	for _, commenter := range owners {
		for _, post := range posts {
			comments, err := loadCommentFile(ctx, githubStorage, githubToken, commenter.Login, repoName, post.owner.Login, post.image.ID)
			if err != nil {
				if !storage.IsNotFound(err) {
					log.Printf("comments %s -> %s/%s: %v", commenter.Login, post.owner.Login, post.image.ID, err)
				}
				continue
			}

			for _, comment := range comments.Comments {
				comment.PostOwner = post.owner.Login
				comment.PostID = post.image.ID
				comment.AuthorLogin = commenter.Login
				comment.AuthorAvatar = resolveAvatar(ownerByLogin, commenter.Login)
				comment.Hidden = hasHidden(post.hiddenIDs, comment.ID)

				imagePaths, err := migrateCommentAssets(ctx, githubStorage, githubToken, cloudinaryStorage, commenter.Login, repoName, comment)
				if err != nil {
					log.Printf("comment assets %s/%s/%s: %v", commenter.Login, post.owner.Login, comment.ID, err)
					continue
				}

				if imagePaths == nil {
					imagePaths = []string{}
				}

				comment.ImagePaths = imagePaths
				comment.ImagePath = ""

				if err := supabaseStorage.UpsertComment(ctx, comment); err != nil {
					log.Printf("upsert comment %s/%s/%s: %v", commenter.Login, post.owner.Login, comment.ID, err)
				}
			}
		}
	}

	log.Printf("migration completed: %d owners, %d posts", len(owners), len(posts))
}

func loadImageIndex(ctx context.Context, githubStorage *storage.GitHubStorage, token string, owner string, repoName string) ([]model.Image, error) {
	content, _, _, err := githubStorage.GetFile(ctx, token, owner, repoName, "index.json")
	if err != nil {
		return nil, err
	}

	var index model.ImageIndex
	if err := json.Unmarshal(content, &index); err != nil {
		return nil, err
	}

	for indexPosition := range index.Items {
		index.Items[indexPosition].NormalizeTimeFields()
	}
	return index.Items, nil
}

func loadLikeFile(ctx context.Context, githubStorage *storage.GitHubStorage, token string, owner string, repoName string, postID string) (*model.LikeFile, error) {
	content, _, _, err := githubStorage.GetFile(ctx, token, owner, repoName, fmt.Sprintf("likes/%s.json", postID))
	if err != nil {
		if storage.IsNotFound(err) {
			return &model.LikeFile{}, nil
		}
		return nil, err
	}

	var likeFile model.LikeFile
	if err := json.Unmarshal(content, &likeFile); err != nil {
		return nil, err
	}
	return &likeFile, nil
}

func loadHiddenIDs(ctx context.Context, githubStorage *storage.GitHubStorage, token string, owner string, repoName string, postID string) (map[string]struct{}, error) {
	content, _, _, err := githubStorage.GetFile(ctx, token, owner, repoName, fmt.Sprintf("hidden-comments/%s.json", postID))
	if err != nil {
		if storage.IsNotFound(err) {
			return map[string]struct{}{}, nil
		}
		return nil, err
	}

	var hidden model.HiddenCommentFile
	if err := json.Unmarshal(content, &hidden); err != nil {
		return nil, err
	}

	result := make(map[string]struct{}, len(hidden.HiddenIDs))
	for _, hiddenID := range hidden.HiddenIDs {
		result[hiddenID] = struct{}{}
	}
	return result, nil
}

func loadCommentFile(ctx context.Context, githubStorage *storage.GitHubStorage, token string, commenter string, repoName string, postOwner string, postID string) (*model.CommentFile, error) {
	content, _, _, err := githubStorage.GetFile(ctx, token, commenter, repoName, fmt.Sprintf("comments/%s/%s.json", postOwner, postID))
	if err != nil {
		return nil, err
	}

	var commentFile model.CommentFile
	if err := json.Unmarshal(content, &commentFile); err != nil {
		return nil, err
	}
	return &commentFile, nil
}

func migrateImageAssets(ctx context.Context, githubStorage *storage.GitHubStorage, token string, cloudinaryStorage *storage.CloudinaryStorage, owner string, repoName string, image model.Image) ([]string, error) {
	legacyPaths := image.AllImagePaths()
	result := make([]string, 0, len(legacyPaths))
	for assetIndex, legacyPath := range legacyPaths {
		payload, _, contentType, err := githubStorage.GetFile(ctx, token, owner, repoName, legacyPath)
		if err != nil {
			return nil, err
		}
		objectKey := fmt.Sprintf("images/%s/%s/%d", owner, image.ID, assetIndex)
		if err := cloudinaryStorage.PutObject(ctx, objectKey, payload, contentType); err != nil {
			return nil, err
		}
		result = append(result, objectKey)
	}
	return result, nil
}

func migrateCommentAssets(ctx context.Context, githubStorage *storage.GitHubStorage, token string, cloudinaryStorage *storage.CloudinaryStorage, commenter string, repoName string, comment model.Comment) ([]string, error) {
	legacyPaths := comment.AllImagePaths()
	result := make([]string, 0, len(legacyPaths))
	for assetIndex, legacyPath := range legacyPaths {
		payload, _, contentType, err := githubStorage.GetFile(ctx, token, commenter, repoName, legacyPath)
		if err != nil {
			return nil, err
		}
		objectKey := fmt.Sprintf("comments/%s/%s/%s/%s/%d", commenter, comment.PostOwner, comment.PostID, comment.ID, assetIndex)
		if err := cloudinaryStorage.PutObject(ctx, objectKey, payload, contentType); err != nil {
			return nil, err
		}
		result = append(result, objectKey)
	}
	return result, nil
}

func postKey(ownerLogin string, postID string) string {
	return strings.ToLower(ownerLogin) + "/" + postID
}

func hasHidden(hiddenIDs map[string]struct{}, commentID string) bool {
	_, ok := hiddenIDs[commentID]
	return ok
}

func resolveAvatar(ownerByLogin map[string]model.GitHubUser, login string) string {
	if user, ok := ownerByLogin[strings.ToLower(login)]; ok && strings.TrimSpace(user.AvatarURL) != "" {
		return user.AvatarURL
	}
	if strings.TrimSpace(login) == "" {
		return ""
	}
	return fmt.Sprintf("https://github.com/%s.png?size=64", login)
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

func getenv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
