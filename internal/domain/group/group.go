package group

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Group struct {
	ID        uuid.UUID
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

var ErrNameEmpty = errors.New("group name must not be empty")
var ErrNameTooLong = errors.New("group name too long")
var ErrWrongTimeFormat = errors.New("updated at before created at")

func NewGroup(id uuid.UUID, name string, createdAt, updatedAt time.Time) (*Group, error) {
	if len(name) == 0 {
		return nil, ErrNameEmpty
	}

	if len(name) > 50 {
		return nil, ErrNameTooLong
	}

	if updatedAt.Before(createdAt) {
		return nil, ErrWrongTimeFormat
	}

	return &Group{
		ID:        id,
		Name:      name,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}, nil
}

type Role string

const (
	RoleOwner  Role = "owner"
	RoleMember Role = "member"
	RoleReader Role = "reader"
)

type Member struct {
	GroupID  uuid.UUID
	UserID   uuid.UUID
	Role     Role
	JoinedAt time.Time
}

// roleRank задаёт порядок ролей по привилегиям: reader < member < owner.
var roleRank = map[Role]int{
	RoleReader: 0,
	RoleMember: 1,
	RoleOwner:  2,
}

// AtLeast проверяет, что r даёт не меньше прав, чем min. Неизвестная роль
// получает ранг 0 (как reader), т.е. AtLeast fail-closed.
func (r Role) AtLeast(min Role) bool {
	return roleRank[r] >= roleRank[min]
}

var ErrInvalidRole = errors.New("invalid group member role")

func NewGroupMember(groupID, userID uuid.UUID, role Role, joinedAt time.Time) (*Member, error) {
	switch role {
	case RoleOwner, RoleMember, RoleReader:
	default:
		return nil, ErrInvalidRole
	}

	return &Member{
		GroupID:  groupID,
		UserID:   userID,
		Role:     role,
		JoinedAt: joinedAt,
	}, nil
}

type InviteStatus string

const (
	InviteStatusPending  InviteStatus = "pending"
	InviteStatusAccepted InviteStatus = "accepted"
	InviteStatusRevoked  InviteStatus = "revoked"
	InviteStatusExpired  InviteStatus = "expired"
)

type Invite struct {
	ID          uuid.UUID
	GroupID     uuid.UUID
	InvitedUser uuid.UUID
	Status      InviteStatus
	InvitedBy   uuid.UUID
	CreatedAt   time.Time
	ExpiresAt   time.Time
}

var ErrInvalidInviteStatus = errors.New("invalid invite status")
var ErrExpiresBeforeCreated = errors.New("expires at before created at")

func NewInvite(id, groupID, invitedUser uuid.UUID, status InviteStatus, invitedBy uuid.UUID, createdAt, expiresAt time.Time) (*Invite, error) {
	switch status {
	case InviteStatusPending, InviteStatusAccepted, InviteStatusRevoked, InviteStatusExpired:
	default:
		return nil, ErrInvalidInviteStatus
	}

	if expiresAt.Before(createdAt) {
		return nil, ErrExpiresBeforeCreated
	}

	return &Invite{
		ID:          id,
		GroupID:     groupID,
		InvitedUser: invitedUser,
		Status:      status,
		InvitedBy:   invitedBy,
		CreatedAt:   createdAt,
		ExpiresAt:   expiresAt,
	}, nil
}
