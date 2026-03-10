package storage

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
)

func ApplySchemaFile(ctx context.Context, databaseURL string, schemaPath string) error {
	if strings.TrimSpace(databaseURL) == "" {
		return fmt.Errorf("SUPABASE_DB_URL is required when AUTO_APPLY_SCHEMA=true")
	}

	payload, err := os.ReadFile(schemaPath)
	if err != nil {
		return err
	}

	schemaSQL := strings.TrimSpace(string(payload))
	if schemaSQL == "" {
		return nil
	}

	connection, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer connection.Close(ctx)

	if _, err := connection.Exec(ctx, schemaSQL); err != nil {
		return err
	}

	return nil
}