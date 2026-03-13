package service

import (
	"context"
	"time"

	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

const defaultLoginAttemptLimit = int64(5)

type LoginLimiter struct {
	store *storage.Store
	limit int64
}

func NewLoginLimiter(store *storage.Store, limit int64) *LoginLimiter {
	if limit <= 0 {
		limit = defaultLoginAttemptLimit
	}
	return &LoginLimiter{store: store, limit: limit}
}

func (limiter *LoginLimiter) Enabled() bool {
	return limiter != nil && limiter.store != nil && limiter.store.Enabled() && limiter.limit > 0
}

func (limiter *LoginLimiter) Allow(ctx context.Context, ip string) (bool, int64, time.Duration, error) {
	if !limiter.Enabled() {
		return true, 0, 0, nil
	}

	count, ttl, err := limiter.store.IncrementLoginAttempt(ctx, ip)
	if err != nil {
		return false, 0, 0, err
	}

	return count <= limiter.limit, count, ttl, nil
}
