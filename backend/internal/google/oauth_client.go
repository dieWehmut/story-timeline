package google

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type OAuthClient struct {
	config *oauth2.Config
}

func NewOAuthClient(clientID string, clientSecret string, callbackURL string) *OAuthClient {
	return &OAuthClient{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			Endpoint:     google.Endpoint,
			RedirectURL:  callbackURL,
			Scopes: []string{
				"https://www.googleapis.com/auth/userinfo.profile",
				"https://www.googleapis.com/auth/userinfo.email",
			},
		},
	}
}

func (client *OAuthClient) AuthCodeURL(state string, redirectURL string) string {
	return client.withRedirectURL(redirectURL).AuthCodeURL(state, oauth2.AccessTypeOnline)
}

func (client *OAuthClient) Exchange(ctx context.Context, code string, redirectURL string) (*oauth2.Token, error) {
	return client.withRedirectURL(redirectURL).Exchange(ctx, code)
}

func (client *OAuthClient) withRedirectURL(redirectURL string) *oauth2.Config {
	configCopy := *client.config
	if redirectURL != "" {
		configCopy.RedirectURL = redirectURL
	}
	return &configCopy
}

type UserInfo struct {
	Id      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func (client *OAuthClient) FetchUser(ctx context.Context, token string) (UserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return UserInfo{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return UserInfo{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return UserInfo{}, fmt.Errorf("failed to fetch google user info, status %d", resp.StatusCode)
	}

	var info UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return UserInfo{}, err
	}

	return info, nil
}
