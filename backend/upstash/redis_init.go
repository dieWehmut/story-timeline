package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/dieWehmut/story-timeline/backend/internal/storage"
	"go.uber.org/zap"
)

func main() {
	logger, err := zap.NewProduction()
	if err != nil {
		panic(err)
	}
	defer func() {
		_ = logger.Sync()
	}()
	zap.ReplaceGlobals(logger)

	ctx := context.Background()

	client, err := storage.NewClient(os.Getenv("REDIS_URL"))
	if err != nil {
		zap.L().Fatal("redis not configured", zap.Error(err))
	}

	store := storage.NewStore(client)
	defer func() {
		_ = store.Close()
	}()

	if err := store.Ping(ctx); err != nil {
		zap.L().Fatal("redis ping failed", zap.Error(err))
	}

	magicToken := fmt.Sprintf("ci-%d", time.Now().UnixNano())
	if err := store.SetMagicLinkToken(ctx, magicToken, "ok"); err != nil {
		zap.L().Fatal("set magic link token failed", zap.Error(err))
	}
	if _, err := store.GetMagicLinkToken(ctx, magicToken); err != nil {
		zap.L().Fatal("get magic link token failed", zap.Error(err))
	}
	if _, err := store.ConsumeMagicLinkToken(ctx, magicToken); err != nil {
		zap.L().Fatal("consume magic link token failed", zap.Error(err))
	}

	ipKey := fmt.Sprintf("ci-%d", time.Now().UnixNano())
	if _, _, err := store.IncrementLoginAttempt(ctx, ipKey); err != nil {
		zap.L().Fatal("increment login attempt failed", zap.Error(err))
	}
	if err := store.ResetLoginAttempts(ctx, ipKey); err != nil {
		zap.L().Fatal("reset login attempt failed", zap.Error(err))
	}

	userKey := fmt.Sprintf("ci-%d", time.Now().UnixNano())
	if err := store.SetTimelineCache(ctx, userKey, "ok"); err != nil {
		zap.L().Fatal("set timeline cache failed", zap.Error(err))
	}
	if _, err := store.GetTimelineCache(ctx, userKey); err != nil {
		zap.L().Fatal("get timeline cache failed", zap.Error(err))
	}
	if err := store.DeleteTimelineCache(ctx, userKey); err != nil {
		zap.L().Fatal("delete timeline cache failed", zap.Error(err))
	}

	streamName := fmt.Sprintf("stream:ci:%d", time.Now().Unix())
	groupName := "ci-group"
	consumerName := "ci-consumer"
	if err := store.EnsureStreamGroup(ctx, streamName, groupName, "$"); err != nil {
		zap.L().Fatal("ensure stream group failed", zap.Error(err))
	}
	if _, err := store.AddStream(ctx, streamName, map[string]string{
		"event":  "init",
		"status": "ok",
	}, 0); err != nil {
		zap.L().Fatal("add stream entry failed", zap.Error(err))
	}
	messages, err := store.ReadGroup(ctx, streamName, groupName, consumerName, ">", 10, 0)
	if err != nil && !storage.IsStreamEmpty(err) {
		zap.L().Fatal("read stream group failed", zap.Error(err))
	}
	if len(messages) > 0 {
		ids := make([]string, 0, len(messages))
		for _, msg := range messages {
			ids = append(ids, msg.ID)
		}
		if _, err := store.AckStream(ctx, streamName, groupName, ids...); err != nil {
			zap.L().Fatal("ack stream messages failed", zap.Error(err))
		}
	}

	zap.L().Info("redis init ok")
}
