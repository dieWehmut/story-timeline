package model

import "time"

type EmailLogin struct {
	TokenHash  string
	Email      string
	Login      string
	AvatarURL  string
	CreatedAt  time.Time
	ExpiresAt  time.Time
	ConsumedAt *time.Time
}
