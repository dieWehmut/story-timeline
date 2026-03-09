package model

import "time"

type Image struct {
	ID           string    `json:"id"`
	AuthorLogin  string    `json:"authorLogin,omitempty"`
	AuthorAvatar string    `json:"authorAvatar,omitempty"`
	Description  string    `json:"description"`
	CapturedAt   time.Time `json:"capturedAt"`
	ImagePath    string    `json:"imagePath"`
	MetadataPath string    `json:"metadataPath"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type ImageIndex struct {
	Items []Image `json:"items"`
}