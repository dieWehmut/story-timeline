package github

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/dieWehmut/story-timeline/backend/internal/model"
)

const graphqlEndpoint = "https://api.github.com/graphql"

type GraphQLClient struct {
	httpClient *http.Client
}

func NewGraphQLClient() *GraphQLClient {
	return &GraphQLClient{httpClient: &http.Client{}}
}

type graphqlRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
}

type graphqlResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"errors,omitempty"`
}

func (c *GraphQLClient) execute(ctx context.Context, token string, query string, variables map[string]any, result any) error {
	body, err := json.Marshal(graphqlRequest{Query: query, Variables: variables})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, graphqlEndpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("graphql request failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var gqlResp graphqlResponse
	if err := json.NewDecoder(resp.Body).Decode(&gqlResp); err != nil {
		return err
	}

	if len(gqlResp.Errors) > 0 {
		return fmt.Errorf("graphql error: %s", gqlResp.Errors[0].Message)
	}

	if result != nil {
		return json.Unmarshal(gqlResp.Data, result)
	}

	return nil
}

// FetchUser gets the authenticated user's info via GraphQL.
func (c *GraphQLClient) FetchUser(ctx context.Context, token string) (model.GitHubUser, error) {
	query := `query { viewer { databaseId login avatarUrl } }`

	var data struct {
		Viewer struct {
			DatabaseID int64  `json:"databaseId"`
			Login      string `json:"login"`
			AvatarURL  string `json:"avatarUrl"`
		} `json:"viewer"`
	}

	if err := c.execute(ctx, token, query, nil, &data); err != nil {
		return model.GitHubUser{}, err
	}

	return model.GitHubUser{
		ID:        data.Viewer.DatabaseID,
		Login:     data.Viewer.Login,
		AvatarURL: data.Viewer.AvatarURL,
	}, nil
}

// FetchFollowing returns the list of users the authenticated user follows.
func (c *GraphQLClient) FetchFollowing(ctx context.Context, token string) ([]model.GitHubUser, error) {
	query := `query($cursor: String) {
		viewer {
			following(first: 100, after: $cursor) {
				pageInfo { hasNextPage endCursor }
				nodes { databaseId login avatarUrl }
			}
		}
	}`

	var all []model.GitHubUser
	var cursor *string

	for {
		vars := map[string]any{}
		if cursor != nil {
			vars["cursor"] = *cursor
		}

		var data struct {
			Viewer struct {
				Following struct {
					PageInfo struct {
						HasNextPage bool   `json:"hasNextPage"`
						EndCursor   string `json:"endCursor"`
					} `json:"pageInfo"`
					Nodes []struct {
						DatabaseID int64  `json:"databaseId"`
						Login      string `json:"login"`
						AvatarURL  string `json:"avatarUrl"`
					} `json:"nodes"`
				} `json:"following"`
			} `json:"viewer"`
		}

		if err := c.execute(ctx, token, query, vars, &data); err != nil {
			return nil, err
		}

		for _, node := range data.Viewer.Following.Nodes {
			all = append(all, model.GitHubUser{
				ID:        node.DatabaseID,
				Login:     node.Login,
				AvatarURL: node.AvatarURL,
			})
		}

		if !data.Viewer.Following.PageInfo.HasNextPage {
			break
		}
		cursor = &data.Viewer.Following.PageInfo.EndCursor
	}

	return all, nil
}

// FetchFollowers returns the list of users who follow the authenticated user.
func (c *GraphQLClient) FetchFollowers(ctx context.Context, token string) ([]model.GitHubUser, error) {
	query := `query($cursor: String) {
		viewer {
			followers(first: 100, after: $cursor) {
				pageInfo { hasNextPage endCursor }
				nodes { databaseId login avatarUrl }
			}
		}
	}`

	var all []model.GitHubUser
	var cursor *string

	for {
		vars := map[string]any{}
		if cursor != nil {
			vars["cursor"] = *cursor
		}

		var data struct {
			Viewer struct {
				Followers struct {
					PageInfo struct {
						HasNextPage bool   `json:"hasNextPage"`
						EndCursor   string `json:"endCursor"`
					} `json:"pageInfo"`
					Nodes []struct {
						DatabaseID int64  `json:"databaseId"`
						Login      string `json:"login"`
						AvatarURL  string `json:"avatarUrl"`
					} `json:"nodes"`
				} `json:"followers"`
			} `json:"viewer"`
		}

		if err := c.execute(ctx, token, query, vars, &data); err != nil {
			return nil, err
		}

		for _, node := range data.Viewer.Followers.Nodes {
			all = append(all, model.GitHubUser{
				ID:        node.DatabaseID,
				Login:     node.Login,
				AvatarURL: node.AvatarURL,
			})
		}

		if !data.Viewer.Followers.PageInfo.HasNextPage {
			break
		}
		cursor = &data.Viewer.Followers.PageInfo.EndCursor
	}

	return all, nil
}

// SearchRepoOwners returns owners of repositories whose name matches repoName.
func (c *GraphQLClient) SearchRepoOwners(ctx context.Context, token string, repoName string) ([]model.GitHubUser, error) {
	query := `query($query: String!, $cursor: String) {
		search(query: $query, type: REPOSITORY, first: 100, after: $cursor) {
			pageInfo { hasNextPage endCursor }
			nodes {
				... on Repository {
					name
					owner {
						login
						avatarUrl
					}
				}
			}
		}
	}`

	searchQuery := fmt.Sprintf("%s in:name", repoName)
	var all []model.GitHubUser
	seen := map[string]struct{}{}
	var cursor *string

	for {
		vars := map[string]any{"query": searchQuery}
		if cursor != nil {
			vars["cursor"] = *cursor
		}

		var data struct {
			Search struct {
				PageInfo struct {
					HasNextPage bool   `json:"hasNextPage"`
					EndCursor   string `json:"endCursor"`
				} `json:"pageInfo"`
				Nodes []struct {
					Name  string `json:"name"`
					Owner struct {
						Login     string `json:"login"`
						AvatarURL string `json:"avatarUrl"`
					} `json:"owner"`
				} `json:"nodes"`
			} `json:"search"`
		}

		if err := c.execute(ctx, token, query, vars, &data); err != nil {
			return nil, err
		}

		for _, node := range data.Search.Nodes {
			if !strings.EqualFold(node.Name, repoName) || node.Owner.Login == "" {
				continue
			}
			loginKey := strings.ToLower(node.Owner.Login)
			if _, ok := seen[loginKey]; ok {
				continue
			}
			seen[loginKey] = struct{}{}
			all = append(all, model.GitHubUser{
				Login:     node.Owner.Login,
				AvatarURL: node.Owner.AvatarURL,
			})
		}

		if !data.Search.PageInfo.HasNextPage {
			break
		}
		cursor = &data.Search.PageInfo.EndCursor
	}

	return all, nil
}

// CheckRepo returns true if the specified user has the given repository.
func (c *GraphQLClient) CheckRepo(ctx context.Context, token string, owner string, repoName string) (bool, error) {
	query := `query($owner: String!, $name: String!) {
		repository(owner: $owner, name: $name) { name }
	}`

	var data struct {
		Repository *struct {
			Name string `json:"name"`
		} `json:"repository"`
	}

	err := c.execute(ctx, token, query, map[string]any{"owner": owner, "name": repoName}, &data)
	if err != nil {
		if strings.Contains(err.Error(), "Could not resolve") {
			return false, nil
		}
		return false, err
	}

	return data.Repository != nil, nil
}

// CreateRepo creates a new public repository for the authenticated user.
func (c *GraphQLClient) CreateRepo(ctx context.Context, token string, name string) error {
	query := `mutation($name: String!) {
		createRepository(input: {name: $name, visibility: PUBLIC, description: "story-timeline data repository"}) {
			repository { name }
		}
	}`

	return c.execute(ctx, token, query, map[string]any{
		"name": name,
	}, nil)
}

// InitializeRepo creates the initial index.json in a new empty repository.
// Uses REST because createCommitOnBranch requires an existing HEAD.
func (c *GraphQLClient) InitializeRepo(ctx context.Context, token string, owner string, repo string, branch string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/index.json", owner, repo)

	initialIndex := `{"items":[]}`
	body, _ := json.Marshal(map[string]string{
		"message": "Initialize story-timeline-data",
		"content": base64.StdEncoding.EncodeToString([]byte(initialIndex)),
		"branch":  branch,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("init repo failed: %s", strings.TrimSpace(string(respBody)))
	}

	return nil
}
