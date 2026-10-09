package subscribe

import (
	"context"
	"encoding/binary"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// RecordRequest records a confirmation email to the address behind addressHash, unless
// limit of them were already sent within window before now. It reports whether the
// email may go out; a refused request is not recorded, so it does not extend the wait.
func (s *Store) RecordRequest(ctx context.Context, addressHash []byte, now time.Time, limit int, window time.Duration) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx) // a no-op once committed

	// Two requests for the same address at once must not both see room for one more.
	// The lock is per address and held until the transaction ends.
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", int64(binary.BigEndian.Uint64(addressHash))); err != nil {
		return false, err
	}

	since := now.Add(-window)

	// Nothing older than the window is ever counted again.
	if _, err := tx.Exec(ctx, "DELETE FROM subscribe_requests WHERE requested_at <= $1", since); err != nil {
		return false, err
	}

	var sent int
	if err := tx.QueryRow(ctx,
		"SELECT COUNT(*) FROM subscribe_requests WHERE address_hash = $1 AND requested_at > $2",
		addressHash, since,
	).Scan(&sent); err != nil {
		return false, err
	}
	if sent >= limit {
		return false, tx.Commit(ctx)
	}

	if _, err := tx.Exec(ctx,
		"INSERT INTO subscribe_requests (address_hash, requested_at) VALUES ($1, $2)",
		addressHash, now,
	); err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

// RecordConfirmation keeps the proof that an address was confirmed: when it was asked
// for, and when the link was clicked.
func (s *Store) RecordConfirmation(ctx context.Context, req Request, confirmedAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		"INSERT INTO subscribe_confirmations (email, requested_at, confirmed_at) VALUES ($1, $2, $3)",
		req.Email, req.RequestedAt, confirmedAt,
	)
	return err
}
