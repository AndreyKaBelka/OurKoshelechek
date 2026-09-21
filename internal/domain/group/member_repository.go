package group

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"OurKoshelechek/internal/platform"
)

var ErrMemberNotFound = errors.New("group member not found")

type MemberRepository struct {
	db platform.DBTX
}

func NewMemberRepository(db platform.DBTX) *MemberRepository {
	return &MemberRepository{db: db}
}

func (r *MemberRepository) Add(ctx context.Context, m Member) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO group_members (group_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, $4)
	`, m.GroupID, m.UserID, m.Role, m.JoinedAt)
	if err != nil {
		return fmt.Errorf("insert group member: %w", err)
	}
	return nil
}

func (r *MemberRepository) Get(ctx context.Context, groupID, userID uuid.UUID) (*Member, error) {
	var m Member
	err := r.db.QueryRow(ctx, `
		SELECT group_id, user_id, role, joined_at
		FROM group_members
		WHERE group_id = $1 AND user_id = $2
	`, groupID, userID).Scan(&m.GroupID, &m.UserID, &m.Role, &m.JoinedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMemberNotFound
		}
		return nil, fmt.Errorf("select group member: %w", err)
	}
	return &m, nil
}

func (r *MemberRepository) Remove(ctx context.Context, groupID, userID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM group_members
		WHERE group_id = $1 AND user_id = $2
	`, groupID, userID)
	if err != nil {
		return fmt.Errorf("delete group member: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrMemberNotFound
	}
	return nil
}

func (r *MemberRepository) ListByGroup(ctx context.Context, groupID uuid.UUID) ([]Member, error) {
	rows, err := r.db.Query(ctx, `
		SELECT group_id, user_id, role, joined_at
		FROM group_members
		WHERE group_id = $1
		ORDER BY joined_at
	`, groupID)
	if err != nil {
		return nil, fmt.Errorf("select group members: %w", err)
	}
	defer rows.Close()

	var members []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.GroupID, &m.UserID, &m.Role, &m.JoinedAt); err != nil {
			return nil, fmt.Errorf("scan group member: %w", err)
		}
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate group members: %w", err)
	}
	return members, nil
}

// CountByGroup returns the number of members in a group.
func (r *MemberRepository) CountByGroup(ctx context.Context, groupID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT count(*) FROM group_members WHERE group_id = $1
	`, groupID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count group members: %w", err)
	}
	return count, nil
}
