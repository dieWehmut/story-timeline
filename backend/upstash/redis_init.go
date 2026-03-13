package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/dieWehmut/story-timeline/backend/internal/storage"
)

func main() {
	ctx := context.Background()

	client, err := storage.NewClient(os.Getenv("REDIS_URL"))
	if err != nil {
		log.Fatalf("redis not configured: %v", err)
	}

	store := storage.NewStore(client)
	defer func() {
		_ = store.Close()
	}()

	if err := store.Ping(ctx); err != nil {
		log.Fatalf("redis ping failed: %v", err)
	}

	magicToken := fmt.Sprintf("ci-%d", time.Now().UnixNano())
	if err := store.SetMagicLinkToken(ctx, magicToken, "ok"); err != nil {
		log.Fatalf("set magic link token failed: %v", err)
	}
	if _, err := store.GetMagicLinkToken(ctx, magicToken); err != nil {
		log.Fatalf("get magic link token failed: %v", err)
	}
	if _, err := store.ConsumeMagicLinkToken(ctx, magicToken); err != nil {
		log.Fatalf("consume magic link token failed: %v", err)
	}

	ipKey := fmt.Sprintf("ci-%d", time.Now().UnixNano())
	if _, _, err := store.IncrementLoginAttempt(ctx, ipKey); err != nil {
		log.Fatalf("increment login attempt failed: %v", err)
	}
	if err := store.ResetLoginAttempts(ctx, ipKey); err != nil {
		log.Fatalf("reset login attempt failed: %v", err)
	}

	userKey := fmt.Sprintf("ci-%d", time.Now().UnixNano())
	if err := store.SetTimelineCache(ctx, userKey, "ok"); err != nil {
		log.Fatalf("set timeline cache failed: %v", err)
	}
	if _, err := store.GetTimelineCache(ctx, userKey); err != nil {
		log.Fatalf("get timeline cache failed: %v", err)
	}
	if err := store.DeleteTimelineCache(ctx, userKey); err != nil {
		log.Fatalf("delete timeline cache failed: %v", err)
	}

	streamName := fmt.Sprintf("stream:ci:%d", time.Now().Unix())
	groupName := "ci-group"
	consumerName := "ci-consumer"
	if err := store.EnsureStreamGroup(ctx, streamName, groupName, "$"); err != nil {
		log.Fatalf("ensure stream group failed: %v", err)
	}
	if _, err := store.AddStream(ctx, streamName, map[string]string{
		"event":  "init",
		"status": "ok",
	}, 0); err != nil {
		log.Fatalf("add stream entry failed: %v", err)
	}
	messages, err := store.ReadGroup(ctx, streamName, groupName, consumerName, ">", 10, 0)
	if err != nil && !storage.IsStreamEmpty(err) {
		log.Fatalf("read stream group failed: %v", err)
	}
	if len(messages) > 0 {
		ids := make([]string, 0, len(messages))
		for _, msg := range messages {
			ids = append(ids, msg.ID)
		}
		if _, err := store.AckStream(ctx, streamName, groupName, ids...); err != nil {
			log.Fatalf("ack stream messages failed: %v", err)
		}
	}

	log.Println("redis init ok")
}
