package model

import "time"

type Image struct {
	ID           string    `json:"id"`
	AuthorLogin  string    `json:"authorLogin,omitempty"`
	AuthorAvatar string    `json:"authorAvatar,omitempty"`
	Description  string    `json:"description"`
	CapturedAt   time.Time `json:"capturedAt"`
	ImagePath    string    `json:"imagePath,omitempty"`
	ImagePaths   []string  `json:"imagePaths,omitempty"`
	MetadataPath string    `json:"metadataPath"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
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
	CreatedAt time.Time `json:"createdAt"`
}

// CommentFile is persisted as comments/{postOwnerLogin}/{postID}.json in the commenter's repo.
type CommentFile struct {
	Comments []Comment `json:"comments"`
}