package dto

import "github.com/dieWehmut/story-timeline/backend/internal/model"

type ImageResponse struct {
	ID           string   `json:"id"`
	AuthorLogin  string   `json:"authorLogin"`
	AuthorAvatar string   `json:"authorAvatar"`
	Description  string   `json:"description"`
	Tags         []string `json:"tags"`
	TimeMode     string   `json:"timeMode"`
	StartAt      string   `json:"startAt"`
	EndAt        string   `json:"endAt,omitempty"`
	CapturedAt   string   `json:"capturedAt,omitempty"`
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
	image.NormalizeTimeFields()
	response := ImageResponse{
		ID:           image.ID,
		AuthorLogin:  image.AuthorLogin,
		AuthorAvatar: image.AuthorAvatar,
		Description:  image.Description,
		Tags:         image.Tags,
		TimeMode:     image.TimeMode,
		StartAt:      image.StartAt.Format("2006-01-02T15:04:05-07:00"),
		CapturedAt:   image.StartAt.Format("2006-01-02T15:04:05-07:00"),
		ImageURLs:    assetURLs,
		ImagePaths:   image.AllImagePaths(),
		MetadataPath: image.MetadataPath,
		CreatedAt:    image.CreatedAt.Format("2006-01-02T15:04:05-07:00"),
		UpdatedAt:    image.UpdatedAt.Format("2006-01-02T15:04:05-07:00"),
	}

	if image.TimeMode == model.ImageTimeModeRange && !image.EndAt.IsZero() {
		response.EndAt = image.EndAt.Format("2006-01-02T15:04:05-07:00")
	}

	return response
}

type CommentResponse struct {
	ID          string `json:"id"`
	AuthorLogin string `json:"authorLogin"`
	PostOwner   string `json:"postOwner"`
	PostID      string `json:"postId"`
	Text        string `json:"text"`
	ImageUrl    string `json:"imageUrl,omitempty"`
	ImageURLs   []string `json:"imageUrls,omitempty"`
	CreatedAt   string `json:"createdAt"`
	ParentID    string `json:"parentId,omitempty"`
	ReplyToUserLogin string `json:"replyToUserLogin,omitempty"`
}
