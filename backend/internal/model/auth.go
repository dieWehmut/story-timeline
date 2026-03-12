package model

import "time"

type GitHubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatarUrl"`
}

type AuthUser struct {
	Provider  string `json:"provider"`
	ID        string `json:"id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatarUrl"`
}

type Session struct {
	AccessToken string    `json:"accessToken"`
	User        AuthUser  `json:"user"`
	ExpiresAt   time.Time `json:"expiresAt"`
}