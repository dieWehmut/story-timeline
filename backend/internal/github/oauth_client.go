package github

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
)

type OAuthClient struct {
	config *oauth2.Config
	client *http.Client
}

func NewOAuthClient(clientID string, clientSecret string, callbackURL string) *OAuthClient {
	return &OAuthClient{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			Endpoint:     github.Endpoint,
			RedirectURL:  callbackURL,
			Scopes:       []string{"read:user", "repo"},
		},
		client: &http.Client{},
	}
}

func (client *OAuthClient) AuthCodeURL(state string) string {
	return client.config.AuthCodeURL(state, oauth2.AccessTypeOnline)
}

func (client *OAuthClient) Exchange(ctx context.Context, code string) (*oauth2.Token, error) {
	return client.config.Exchange(ctx, code)
}

func (client *OAuthClient) FetchUser(ctx context.Context, token string) (model.GitHubUser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return model.GitHubUser{}, err
	}

	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := client.client.Do(req)
	if err != nil {
		return model.GitHubUser{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		return model.GitHubUser{}, fmt.Errorf("github user request failed with status %d", resp.StatusCode)
	}

	var payload struct {
		ID        int64  `json:"id"`
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return model.GitHubUser{}, err
	}

	return model.GitHubUser{
		ID:        payload.ID,
		Login:     payload.Login,
		AvatarURL: payload.AvatarURL,
	}, nil
}