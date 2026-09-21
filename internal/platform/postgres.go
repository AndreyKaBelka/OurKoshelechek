package platform

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPG(connString string) (*pgxpool.Pool, error) {
	dbpool, err := pgxpool.New(context.Background(), connString)
	if err != nil {
		return nil, fmt.Errorf("connection pool: %v", err)
	}

	return dbpool, nil
}
