package model

import "time"

const (
	ImageTimeModePoint = "point"
	ImageTimeModeRange = "range"
)

type Image struct {
	ID           string    `json:"id"`
	AuthorLogin  string    `json:"authorLogin,omitempty"`
	AuthorAvatar string    `json:"authorAvatar,omitempty"`
	Description  string    `json:"description"`
	TimeMode     string    `json:"timeMode,omitempty"`
	StartAt      time.Time `json:"startAt,omitempty"`
	EndAt        time.Time `json:"endAt,omitempty"`
	CapturedAt   time.Time `json:"capturedAt,omitempty"`
	ImagePath    string    `json:"imagePath,omitempty"`
	ImagePaths   []string  `json:"imagePaths,omitempty"`
	MetadataPath string    `json:"metadataPath"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func (img *Image) NormalizeTimeFields() {
	if img.TimeMode == "" {
		img.TimeMode = ImageTimeModePoint
	}

	if img.StartAt.IsZero() {
		switch {
		case !img.CapturedAt.IsZero():
			img.StartAt = img.CapturedAt
		case !img.CreatedAt.IsZero():
			img.StartAt = img.CreatedAt
		}
	}

	if img.TimeMode != ImageTimeModeRange {
		img.TimeMode = ImageTimeModePoint
		img.EndAt = time.Time{}
	}

	if img.TimeMode == ImageTimeModeRange && img.EndAt.IsZero() {
		img.EndAt = img.StartAt
	}

	img.CapturedAt = img.StartAt
}

func (img Image) SortTime() time.Time {
	if !img.StartAt.IsZero() {
		return img.StartAt
	}
	if !img.CapturedAt.IsZero() {
		return img.CapturedAt
	}
	return img.CreatedAt
}

// AllImagePaths returns ImagePaths or falls back to the legacy single ImagePath.
func (img Image) AllImagePaths() []string {
	if len(img.ImagePaths) > 0 {
		return img.ImagePaths
	}
	if img.ImagePath != "" {
		return []string{img.ImagePath}
	}
	return nil
}

type ImageIndex struct {
	Items []Image `json:"items"`
}

// Like represents a single like on a post. Stored in the post owner's repo.
type Like struct {
	Login     string    `json:"login"`
	AvatarURL string    `json:"avatarUrl"`
	LikedAt   time.Time `json:"likedAt"`
}

// LikeFile is persisted as likes/{postID}.json in the post owner's repo.
type LikeFile struct {
	Likes []Like `json:"likes"`
}

// Comment represents a single comment on a post. Stored in the commenter's repo.
type Comment struct {
	ID        string    `json:"id"`
	PostOwner string    `json:"postOwner"`
	PostID    string    `json:"postId"`
	Text      string    `json:"text"`
	ImagePath string    `json:"imagePath,omitempty"`
	ImagePaths []string `json:"imagePaths,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

func (comment Comment) AllImagePaths() []string {
	if len(comment.ImagePaths) > 0 {
		return comment.ImagePaths
	}
	if comment.ImagePath != "" {
		return []string{comment.ImagePath}
	}
	return nil
}

// CommentFile is persisted as comments/{postOwnerLogin}/{postID}.json in the commenter's repo.
type CommentFile struct {
	Comments []Comment `json:"comments"`
}