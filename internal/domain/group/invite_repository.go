package group

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"OurKoshelechek/internal/platform"
)

var ErrInviteNotFound = errors.New("group invite not found")

type InviteRepository struct {
	db platform.DBTX
}

func NewInviteRepository(db platform.DBTX) *InviteRepository {
	return &InviteRepository{db: db}
}

func (r *InviteRepository) Create(ctx context.Context, inv Invite) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO group_invites (id, group_id, invited_user, status, invited_by, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, inv.ID, inv.GroupID, inv.InvitedUser, inv.Status, inv.InvitedBy, inv.CreatedAt, inv.ExpiresAt)
	if err != nil {
		return fmt.Errorf("insert group invite: %w", err)
	}
	return nil
}

func (r *InviteRepository) GetByID(ctx context.Context, id uuid.UUID) (*Invite, error) {
	var inv Invite
	err := r.db.QueryRow(ctx, `
		SELECT id, group_id, invited_user, status, invited_by, created_at, expires_at
		FROM group_invites
		WHERE id = $1
	`, id).Scan(&inv.ID, &inv.GroupID, &inv.InvitedUser, &inv.Status, &inv.InvitedBy, &inv.CreatedAt, &inv.ExpiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInviteNotFound
		}
		return nil, fmt.Errorf("select group invite: %w", err)
	}
	return &inv, nil
}

func (r *InviteRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status InviteStatus) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE group_invites SET status = $2 WHERE id = $1
	`, id, status)
	if err != nil {
		return fmt.Errorf("update group invite status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrInviteNotFound
	}
	return nil
}

func (r *InviteRepository) ListByGroup(ctx context.Context, groupID uuid.UUID) ([]Invite, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, group_id, invited_user, status, invited_by, created_at, expires_at
		FROM group_invites
		WHERE group_id = $1
		ORDER BY created_at DESC
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("select group invites: %w", err)
	}
	defer rows.Close()

	var invites []Invite
	for rows.Next() {
		var inv Invite
		if err := rows.Scan(&inv.ID, &inv.GroupID, &inv.InvitedUser, &inv.Status, &inv.InvitedBy, &inv.CreatedAt, &inv.ExpiresAt); err != nil {
			return nil, fmt.Errorf("scan group invite: %w", err)
		}
		invites = append(invites, inv)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate group invites: %w", err)
	}
	return invites, nil
}
