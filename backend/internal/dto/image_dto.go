package dto

import "github.com/dieWehmut/story-timeline/backend/internal/model"

type ImageResponse struct {
	ID           string `json:"id"`
	AuthorLogin  string `json:"authorLogin"`
	AuthorAvatar string `json:"authorAvatar"`
	Description  string `json:"description"`
	CapturedAt   string `json:"capturedAt"`
	ImageURL     string `json:"imageUrl"`
	ImagePath    string `json:"imagePath"`
	MetadataPath string `json:"metadataPath"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

func NewImageResponse(image model.Image, imageURL string) ImageResponse {
	return ImageResponse{
		ID:           image.ID,
		AuthorLogin:  image.AuthorLogin,
		AuthorAvatar: image.AuthorAvatar,
		Description:  image.Description,
		CapturedAt:   image.CapturedAt.Format("2006-01-02T15:04:05-07:00"),
		ImageURL:     imageURL,
		ImagePath:    image.ImagePath,
		MetadataPath: image.MetadataPath,
		CreatedAt:    image.CreatedAt.Format("2006-01-02T15:04:05-07:00"),
		UpdatedAt:    image.UpdatedAt.Format("2006-01-02T15:04:05-07:00"),
	}
}