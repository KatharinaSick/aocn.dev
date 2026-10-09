// Package db opens the PostgreSQL pool and keeps the schema current.
package db

import (
	"context"
	"embed"
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Connect opens a pool and migrates the schema to the latest version.
//
// Migrations run here, at startup, rather than in the deploy workflow: that way they
// use the URL the service already has, and the deploy identity never needs database
// credentials. golang-migrate takes a Postgres advisory lock, so instances starting
// at the same time do not run a migration twice.
func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("opening database pool: %w", err)
	}

	if err := migrateUp(pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrating database: %w", err)
	}
	return pool, nil
}

func migrateUp(pool *pgxpool.Pool) error {
	source, err := iofs.New(migrations, "migrations")
	if err != nil {
		return err
	}

	// Closing this *sql.DB (via m.Close) leaves the pool open.
	driver, err := pgxmigrate.WithInstance(stdlib.OpenDBFromPool(pool), &pgxmigrate.Config{})
	if err != nil {
		return err
	}

	m, err := migrate.NewWithInstance("iofs", source, "pgx5", driver)
	if err != nil {
		return err
	}
	defer m.Close()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	return nil
}
