package github

import (
	"context"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
)

type OAuthClient struct {
	config *oauth2.Config
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
