package dto

import "github.com/dieWehmut/story-timeline/backend/internal/model"

type ImageResponse struct {
	ID           string   `json:"id"`
	AuthorLogin  string   `json:"authorLogin"`
	AuthorAvatar string   `json:"authorAvatar"`
	Description  string   `json:"description"`
	CapturedAt   string   `json:"capturedAt"`
	ImageURLs    []string `json:"imageUrls"`
	ImagePaths   []string `json:"imagePaths"`
	MetadataPath string   `json:"metadataPath"`
	CreatedAt    string   `json:"createdAt"`
	UpdatedAt    string   `json:"updatedAt"`
	LikeCount    int      `json:"likeCount"`
	CommentCount int      `json:"commentCount"`
	Liked        bool     `json:"liked"`
}

func NewImageResponse(image model.Image, assetURLs []string) ImageResponse {
	return ImageResponse{
		ID:           image.ID,
		AuthorLogin:  image.AuthorLogin,
		AuthorAvatar: image.AuthorAvatar,
		Description:  image.Description,
		CapturedAt:   image.CapturedAt.Format("2006-01-02T15:04:05-07:00"),
		ImageURLs:    assetURLs,
		ImagePaths:   image.AllImagePaths(),
		MetadataPath: image.MetadataPath,
		CreatedAt:    image.CreatedAt.Format("2006-01-02T15:04:05-07:00"),
		UpdatedAt:    image.UpdatedAt.Format("2006-01-02T15:04:05-07:00"),
	}
}

type CommentResponse struct {
	ID          string `json:"id"`
	AuthorLogin string `json:"authorLogin"`
	PostOwner   string `json:"postOwner"`
	PostID      string `json:"postId"`
	Text        string `json:"text"`
	CreatedAt   string `json:"createdAt"`
}