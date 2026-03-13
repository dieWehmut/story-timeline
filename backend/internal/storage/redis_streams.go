package storage

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	ErrMissingStream   = errors.New("missing stream")
	ErrMissingGroup    = errors.New("missing group")
	ErrMissingConsumer = errors.New("missing consumer")
	ErrMissingValues   = errors.New("missing stream values")
	ErrStreamEmpty     = errors.New("stream is empty")
)

func (store *Store) AddStream(ctx context.Context, stream string, values map[string]string, maxLen int64) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	stream = strings.TrimSpace(stream)
	if stream == "" {
		return "", ErrMissingStream
	}
	if len(values) == 0 {
		return "", ErrMissingValues
	}

	payload := make(map[string]any, len(values))
	for key, value := range values {
		payload[key] = value
	}

	args := &redis.XAddArgs{
		Stream: stream,
		Values: payload,
	}
	if maxLen > 0 {
		args.MaxLen = maxLen
		args.Approx = true
	}

	return client.XAdd(ctx, args).Result()
}

func (store *Store) ReadStream(ctx context.Context, stream string, startID string, count int64, block time.Duration) ([]redis.XMessage, error) {
	client, err := store.ensureClient()
	if err != nil {
		return nil, err
	}
	stream = strings.TrimSpace(stream)
	if stream == "" {
		return nil, ErrMissingStream
	}
	if strings.TrimSpace(startID) == "" {
		startID = "0"
	}

	args := &redis.XReadArgs{
		Streams: []string{stream, startID},
	}
	if count > 0 {
		args.Count = count
	}
	if block > 0 {
		args.Block = block
	}

	streams, err := client.XRead(ctx, args).Result()
	if err == redis.Nil {
		return nil, ErrStreamEmpty
	}
	if err != nil {
		return nil, err
	}

	return flattenStreams(streams), nil
}

func (store *Store) EnsureStreamGroup(ctx context.Context, stream string, group string, startID string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	stream = strings.TrimSpace(stream)
	group = strings.TrimSpace(group)
	if stream == "" {
		return ErrMissingStream
	}
	if group == "" {
		return ErrMissingGroup
	}
	if strings.TrimSpace(startID) == "" {
		startID = "0"
	}

	err = client.XGroupCreateMkStream(ctx, stream, group, startID).Err()
	if err == nil {
		return nil
	}
	if strings.Contains(err.Error(), "BUSYGROUP") {
		return nil
	}
	return err
}

func (store *Store) ReadGroup(ctx context.Context, stream string, group string, consumer string, startID string, count int64, block time.Duration) ([]redis.XMessage, error) {
	client, err := store.ensureClient()
	if err != nil {
		return nil, err
	}
	stream = strings.TrimSpace(stream)
	group = strings.TrimSpace(group)
	consumer = strings.TrimSpace(consumer)
	if stream == "" {
		return nil, ErrMissingStream
	}
	if group == "" {
		return nil, ErrMissingGroup
	}
	if consumer == "" {
		return nil, ErrMissingConsumer
	}
	if strings.TrimSpace(startID) == "" {
		startID = ">"
	}

	args := &redis.XReadGroupArgs{
		Group:    group,
		Consumer: consumer,
		Streams:  []string{stream, startID},
	}
	if count > 0 {
		args.Count = count
	}
	if block > 0 {
		args.Block = block
	}

	streams, err := client.XReadGroup(ctx, args).Result()
	if err == redis.Nil {
		return nil, ErrStreamEmpty
	}
	if err != nil {
		return nil, err
	}

	return flattenStreams(streams), nil
}

func (store *Store) AckStream(ctx context.Context, stream string, group string, ids ...string) (int64, error) {
	client, err := store.ensureClient()
	if err != nil {
		return 0, err
	}
	stream = strings.TrimSpace(stream)
	group = strings.TrimSpace(group)
	if stream == "" {
		return 0, ErrMissingStream
	}
	if group == "" {
		return 0, ErrMissingGroup
	}
	if len(ids) == 0 {
		return 0, nil
	}

	return client.XAck(ctx, stream, group, ids...).Result()
}

func IsStreamEmpty(err error) bool {
	return errors.Is(err, ErrStreamEmpty) || errors.Is(err, redis.Nil)
}

func flattenStreams(streams []redis.XStream) []redis.XMessage {
	if len(streams) == 0 {
		return nil
	}

	total := 0
	for _, stream := range streams {
		total += len(stream.Messages)
	}
	if total == 0 {
		return nil
	}

	messages := make([]redis.XMessage, 0, total)
	for _, stream := range streams {
		messages = append(messages, stream.Messages...)
	}
	return messages
}
