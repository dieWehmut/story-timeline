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