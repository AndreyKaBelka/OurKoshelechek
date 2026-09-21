package resolvers

import (
	"context"
	"errors"
	"fmt"

	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/group"
	"OurKoshelechek/internal/mapper"
	"OurKoshelechek/internal/platform"
)

var (
	ErrGroupIDArgMissing     = errors.New("directive: field has no groupId argument")
	ErrNotGroupMember        = errors.New("user is not a member of this group")
	ErrInsufficientGroupRole = errors.New("user does not have sufficient role in this group")
)

// groupMembershipReader — подмножество *group.MemberRepository, нужное
// директивам. Объявлено здесь, чтобы тесты могли подставить фейк без БД.
type groupMembershipReader interface {
	Get(ctx context.Context, groupID, userID uuid.UUID) (*group.Member, error)
}

// RequireGroupMembership implements the @requireGroupMembership directive.
func (r *Resolver) RequireGroupMembership(ctx context.Context, obj any, next graphql.Resolver) (any, error) {
	return requireGroupMembership(ctx, r.Repos.GroupMember, next)
}

func requireGroupMembership(ctx context.Context, repo groupMembershipReader, next graphql.Resolver) (any, error) {
	if _, err := checkGroupMembership(ctx, repo); err != nil {
		return nil, err
	}
	return next(ctx)
}

// RequireGroupRole implements the @requireGroupRole(min: GroupRole!) directive.
func (r *Resolver) RequireGroupRole(ctx context.Context, obj any, next graphql.Resolver, min model.GroupRole) (any, error) {
	return requireGroupRole(ctx, r.Repos.GroupMember, next, min)
}

func requireGroupRole(ctx context.Context, repo groupMembershipReader, next graphql.Resolver, min model.GroupRole) (any, error) {
	member, err := checkGroupMembership(ctx, repo)
	if err != nil {
		return nil, err
	}
	if !member.Role.AtLeast(mapper.ToDomainGroupRole(min)) {
		return nil, ErrInsufficientGroupRole
	}
	return next(ctx)
}

func checkGroupMembership(ctx context.Context, repo groupMembershipReader) (*group.Member, error) {
	userID, err := platform.CurrentUserID(ctx)
	if err != nil {
		return nil, err // platform.ErrUnauthenticated
	}

	groupID, err := groupIDFromFieldArgs(ctx)
	if err != nil {
		return nil, err
	}

	member, err := repo.Get(ctx, groupID, userID)
	if err != nil {
		if errors.Is(err, group.ErrMemberNotFound) {
			return nil, ErrNotGroupMember
		}
		return nil, fmt.Errorf("check group membership: %w", err)
	}
	return member, nil
}

// groupIDFromFieldArgs читает аргумент groupId у поля, которое сейчас
// резолвится. gqlgen заполняет FieldContext.Args до вызова FIELD_DEFINITION
// директив, обёрнутых вокруг этого поля.
func groupIDFromFieldArgs(ctx context.Context) (uuid.UUID, error) {
	fc := graphql.GetFieldContext(ctx)
	if fc == nil {
		return uuid.UUID{}, ErrGroupIDArgMissing
	}
	raw, ok := fc.Args["groupId"]
	if !ok {
		return uuid.UUID{}, ErrGroupIDArgMissing
	}
	groupID, ok := raw.(uuid.UUID)
	if !ok {
		return uuid.UUID{}, fmt.Errorf("directive: groupId argument has unexpected type %T", raw)
	}
	return groupID, nil
}
