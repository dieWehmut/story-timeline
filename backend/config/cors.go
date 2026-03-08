package config

func AllowedOrigins(env Env) []string {
	return []string{env.FrontendOrigin}
}