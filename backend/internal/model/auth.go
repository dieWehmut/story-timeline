package model

import "time"

type GitHubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatarUrl"`
	Email     string `json:"email,omitempty"`
}

type AuthUser struct {
	Provider    string `json:"provider"`
	ID          string `json:"id"`
	Login       string `json:"login"`
	AvatarURL   string `json:"avatarUrl"`
	DisplayName string `json:"displayName,omitempty"`
	Email       string `json:"email,omitempty"`
}

type Session struct {
	AccessToken string    `json:"accessToken"`
	User        AuthUser  `json:"user"`
	ExpiresAt   time.Time `json:"expiresAt"`
}
