package storage

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	MagicLinkTokenTTL   = 10 * time.Minute
	OAuthStateTTL       = 10 * time.Minute
	AuthExchangeTTL     = 5 * time.Minute
	LoginAttemptTTL     = 1 * time.Minute
	TimelineCacheTTL    = 30 * time.Second
	EmailPendingTTL     = 10 * time.Minute
	EmailConfirmedTTL   = 5 * time.Minute
	AppOAuthPendingTTL  = 10 * time.Minute
)

var (
	ErrRedisNotConfigured = errors.New("redis is not configured")
	ErrCacheMiss          = errors.New("redis key not found")
	ErrMissingToken       = errors.New("missing token")
	ErrMissingIP          = errors.New("missing ip")
	ErrMissingUser        = errors.New("missing user")
)

type Store struct {
	client *redis.Client
}

func NewClient(redisURL string) (*redis.Client, error) {
	trimmed := strings.TrimSpace(redisURL)
	if trimmed == "" {
		return nil, ErrRedisNotConfigured
	}

	opt, err := redis.ParseURL(trimmed)
	if err != nil {
		return nil, err
	}

	return redis.NewClient(opt), nil
}

func NewStore(client *redis.Client) *Store {
	if client == nil {
		return nil
	}
	return &Store{client: client}
}

func (store *Store) Enabled() bool {
	return store != nil && store.client != nil
}

func (store *Store) Close() error {
	if !store.Enabled() {
		return nil
	}
	return store.client.Close()
}

func (store *Store) Ping(ctx context.Context) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	return client.Ping(ctx).Err()
}

func (store *Store) SetMagicLinkToken(ctx context.Context, token string, payload string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return ErrMissingToken
	}
	return client.Set(ctx, magicTokenKey(token), payload, MagicLinkTokenTTL).Err()
}

func (store *Store) GetMagicLinkToken(ctx context.Context, token string) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return "", ErrMissingToken
	}
	value, err := client.Get(ctx, magicTokenKey(token)).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return value, err
}

func (store *Store) ConsumeMagicLinkToken(ctx context.Context, token string) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return "", ErrMissingToken
	}
	value, err := client.GetDel(ctx, magicTokenKey(token)).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return value, err
}

func (store *Store) SetOAuthState(ctx context.Context, state string, payload string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	state = strings.TrimSpace(state)
	if state == "" {
		return ErrMissingToken
	}
	return client.Set(ctx, oauthStateKey(state), payload, OAuthStateTTL).Err()
}

func (store *Store) ConsumeOAuthState(ctx context.Context, state string) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	state = strings.TrimSpace(state)
	if state == "" {
		return "", ErrMissingToken
	}
	value, err := client.GetDel(ctx, oauthStateKey(state)).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return value, err
}

func (store *Store) SetAuthExchange(ctx context.Context, token string, payload string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return ErrMissingToken
	}
	return client.Set(ctx, authExchangeKey(token), payload, AuthExchangeTTL).Err()
}

func (store *Store) ConsumeAuthExchange(ctx context.Context, token string) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return "", ErrMissingToken
	}
	value, err := client.GetDel(ctx, authExchangeKey(token)).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return value, err
}

func (store *Store) IncrementLoginAttempt(ctx context.Context, ip string) (int64, time.Duration, error) {
	client, err := store.ensureClient()
	if err != nil {
		return 0, 0, err
	}
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return 0, 0, ErrMissingIP
	}

	key := loginAttemptKey(ip)
	count, err := client.Incr(ctx, key).Result()
	if err != nil {
		return 0, 0, err
	}

	ttl, err := client.TTL(ctx, key).Result()
	if err != nil {
		return count, 0, err
	}
	if ttl < 0 {
		if err := client.Expire(ctx, key, LoginAttemptTTL).Err(); err != nil {
			return count, 0, err
		}
		ttl = LoginAttemptTTL
	}

	return count, ttl, nil
}

func (store *Store) GetLoginAttemptCount(ctx context.Context, ip string) (int64, time.Duration, error) {
	client, err := store.ensureClient()
	if err != nil {
		return 0, 0, err
	}
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return 0, 0, ErrMissingIP
	}

	key := loginAttemptKey(ip)
	value, err := client.Get(ctx, key).Int64()
	if err == redis.Nil {
		return 0, 0, ErrCacheMiss
	}
	if err != nil {
		return 0, 0, err
	}

	ttl, err := client.TTL(ctx, key).Result()
	if err != nil {
		return value, 0, err
	}
	return value, ttl, nil
}

func (store *Store) ResetLoginAttempts(ctx context.Context, ip string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return ErrMissingIP
	}
	return client.Del(ctx, loginAttemptKey(ip)).Err()
}

func (store *Store) GetTimelineCache(ctx context.Context, user string) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	user = strings.TrimSpace(user)
	if user == "" {
		return "", ErrMissingUser
	}
	value, err := client.Get(ctx, timelineCacheKey(user)).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return value, err
}

func (store *Store) SetTimelineCache(ctx context.Context, user string, payload string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	user = strings.TrimSpace(user)
	if user == "" {
		return ErrMissingUser
	}
	return client.Set(ctx, timelineCacheKey(user), payload, TimelineCacheTTL).Err()
}

func (store *Store) DeleteTimelineCache(ctx context.Context, user string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	user = strings.TrimSpace(user)
	if user == "" {
		return ErrMissingUser
	}
	return client.Del(ctx, timelineCacheKey(user)).Err()
}

func IsCacheMiss(err error) bool {
	return errors.Is(err, ErrCacheMiss) || errors.Is(err, redis.Nil)
}

func (store *Store) ensureClient() (*redis.Client, error) {
	if store == nil || store.client == nil {
		return nil, ErrRedisNotConfigured
	}
	return store.client, nil
}

func magicTokenKey(token string) string {
	return "magic:token:" + token
}

func oauthStateKey(state string) string {
	return "oauth:state:" + state
}

func authExchangeKey(token string) string {
	return "auth:exchange:" + token
}

func loginAttemptKey(ip string) string {
	return "login:attempt:" + ip
}

func timelineCacheKey(user string) string {
	return "cache:timeline:" + user
}

func emailPendingKey(loginId string) string {
	return "email:pending:" + loginId
}

func emailConfirmedKey(tokenHash string) string {
	return "email:confirmed:" + tokenHash
}

func appOAuthPendingKey(nonce string) string {
	return "app:oauth:pending:" + nonce
}

func (store *Store) SetEmailPendingLogin(ctx context.Context, loginId string, tokenHash string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	loginId = strings.TrimSpace(loginId)
	if loginId == "" {
		return ErrMissingToken
	}
	return client.Set(ctx, emailPendingKey(loginId), tokenHash, EmailPendingTTL).Err()
}

func (store *Store) GetEmailPendingLogin(ctx context.Context, loginId string) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	loginId = strings.TrimSpace(loginId)
	if loginId == "" {
		return "", ErrMissingToken
	}
	value, err := client.Get(ctx, emailPendingKey(loginId)).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return value, err
}

func (store *Store) DeleteEmailPendingLogin(ctx context.Context, loginId string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	loginId = strings.TrimSpace(loginId)
	if loginId == "" {
		return ErrMissingToken
	}
	return client.Del(ctx, emailPendingKey(loginId)).Err()
}

func (store *Store) SetEmailConfirmedSession(ctx context.Context, tokenHash string, sessionJSON string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	tokenHash = strings.TrimSpace(tokenHash)
	if tokenHash == "" {
		return ErrMissingToken
	}
	return client.Set(ctx, emailConfirmedKey(tokenHash), sessionJSON, EmailConfirmedTTL).Err()
}

func (store *Store) ConsumeEmailConfirmedSession(ctx context.Context, tokenHash string) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	tokenHash = strings.TrimSpace(tokenHash)
	if tokenHash == "" {
		return "", ErrMissingToken
	}
	value, err := client.GetDel(ctx, emailConfirmedKey(tokenHash)).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return value, err
}

func (store *Store) SetAppOAuthPending(ctx context.Context, nonce string, exchangeToken string) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	nonce = strings.TrimSpace(nonce)
	if nonce == "" {
		return ErrMissingToken
	}
	return client.Set(ctx, appOAuthPendingKey(nonce), exchangeToken, AppOAuthPendingTTL).Err()
}

func (store *Store) ConsumeAppOAuthPending(ctx context.Context, nonce string) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	nonce = strings.TrimSpace(nonce)
	if nonce == "" {
		return "", ErrMissingToken
	}
	value, err := client.GetDel(ctx, appOAuthPendingKey(nonce)).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return value, err
}

// --- Invite code management ---

const inviteCodeKey = "invite:code:global"

func (store *Store) SetInviteCode(ctx context.Context, code string, ttl time.Duration) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return ErrMissingToken
	}
	if ttl <= 0 {
		// No expiry (persist indefinitely)
		return client.Set(ctx, inviteCodeKey, code, 0).Err()
	}
	return client.Set(ctx, inviteCodeKey, code, ttl).Err()
}

func (store *Store) GetInviteCode(ctx context.Context) (string, error) {
	client, err := store.ensureClient()
	if err != nil {
		return "", err
	}
	value, err := client.Get(ctx, inviteCodeKey).Result()
	if err == redis.Nil {
		return "", ErrCacheMiss
	}
	return value, err
}

func (store *Store) DeleteInviteCode(ctx context.Context) error {
	client, err := store.ensureClient()
	if err != nil {
		return err
	}
	return client.Del(ctx, inviteCodeKey).Err()
}

func (store *Store) GetInviteCodeTTL(ctx context.Context) (time.Duration, error) {
	client, err := store.ensureClient()
	if err != nil {
		return 0, err
	}
	return client.TTL(ctx, inviteCodeKey).Result()
}
