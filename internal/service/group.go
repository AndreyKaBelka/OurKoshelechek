package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/group"
	"OurKoshelechek/internal/mapper"
	"OurKoshelechek/internal/platform"
	"OurKoshelechek/internal/repository"
)

// ErrEmailInviteNotSupported is returned by InviteMember for the email
// path. The schema leaves the invite mechanism as an open product decision
// (see the ⚠️ notes in api/groups/groups.graphql and docs/API_TODO.md), and
// the current DB schema can't support it: users has no email column, and
// group_invites.invited_user is a required FK to an existing user, so
// there's no way to resolve an email to a user server-side. Only the
// username path (direct add) is implemented.
var ErrEmailInviteNotSupported = errors.New("email-based invites are not supported yet: there is no way to link an email to a user in the current schema")

// ErrInviteInputRequired is returned by InviteMember when neither username
// nor email is set on the input.
var ErrInviteInputRequired = errors.New("invite input requires exactly one of username or email")

// ErrInsufficientRoleToRemoveMember is returned by RemoveMember when the
// caller tries to remove a member whose role outranks their own (e.g. a
// MEMBER removing the OWNER). Removing yourself is always allowed regardless
// of role.
var ErrInsufficientRoleToRemoveMember = errors.New("caller does not have sufficient role to remove this member")

// GroupService holds the group business logic that resolvers previously
// implemented inline: creating a group with its owner in one transaction,
// membership management, and assembling a group's full member list.
type GroupService struct {
	repositories *repository.Repositories
	uow          *platform.UnitOfWork
}

func NewGroupService(repositories *repository.Repositories, uow *platform.UnitOfWork) *GroupService {
	return &GroupService{repositories: repositories, uow: uow}
}

// Create makes a new group and adds the current user as its owner member,
// atomically.
func (s *GroupService) Create(ctx context.Context, input model.CreateGroupInput) (*model.Group, error) {
	ownerID, err := platform.CurrentUserID(ctx)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	g, err := group.NewGroup(platform.NewID(), input.Name, now, now)
	if err != nil {
		return nil, err
	}

	m, err := group.NewGroupMember(g.ID, ownerID, group.RoleOwner, now)
	if err != nil {
		return nil, err
	}

	err = repository.RunInTx(ctx, s.uow, func(repos repository.Repositories) error {
		if err := repos.Group.Create(ctx, *g); err != nil {
			return err
		}
		return repos.GroupMember.Add(ctx, *m)
	})
	if err != nil {
		return nil, fmt.Errorf("create group: %w", err)
	}

	return s.loadGroupModel(ctx, g)
}

func (s *GroupService) Update(ctx context.Context, groupID uuid.UUID, input model.UpdateGroupInput) (*model.Group, error) {
	existing, err := s.repositories.Group.GetByID(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("load group %s: %w", groupID, err)
	}

	g, err := group.NewGroup(existing.ID, input.Name, existing.CreatedAt, time.Now())
	if err != nil {
		return nil, err
	}

	if err := s.repositories.Group.Update(ctx, *g); err != nil {
		return nil, fmt.Errorf("update group: %w", err)
	}

	return s.loadGroupModel(ctx, g)
}

// InviteMember supports only the username path (direct add); see
// ErrEmailInviteNotSupported.
func (s *GroupService) InviteMember(ctx context.Context, groupID uuid.UUID, input model.InviteMemberInput) (*model.InviteResult, error) {
	switch {
	case input.Username != nil && input.Email != nil:
		return nil, ErrInviteInputRequired
	case input.Username != nil:
		u, err := s.repositories.User.GetByUsername(ctx, *input.Username)
		if err != nil {
			return nil, fmt.Errorf("look up user %q: %w", *input.Username, err)
		}

		m, err := group.NewGroupMember(groupID, u.ID, group.RoleMember, time.Now())
		if err != nil {
			return nil, err
		}
		if err := s.repositories.GroupMember.Add(ctx, *m); err != nil {
			return nil, fmt.Errorf("add group member: %w", err)
		}
		return &model.InviteResult{MemberID: &u.ID}, nil
	case input.Email != nil:
		return nil, ErrEmailInviteNotSupported
	default:
		return nil, ErrInviteInputRequired
	}
}

// RemoveMember removes userID from groupID. The @requireGroupRole(min:
// MEMBER) directive only checks that the caller is a member, not that they
// outrank the member being removed, so that check happens here: a caller may
// always remove themselves (leave the group), but removing someone else
// requires the caller's role to be at least as high as the target's — e.g. a
// plain MEMBER cannot remove the OWNER.
func (s *GroupService) RemoveMember(ctx context.Context, groupID, userID uuid.UUID) (bool, error) {
	actorID, err := platform.CurrentUserID(ctx)
	if err != nil {
		return false, err
	}

	if actorID != userID {
		actor, err := s.repositories.GroupMember.Get(ctx, groupID, actorID)
		if err != nil {
			return false, fmt.Errorf("load caller membership: %w", err)
		}
		target, err := s.repositories.GroupMember.Get(ctx, groupID, userID)
		if err != nil {
			return false, fmt.Errorf("load target membership: %w", err)
		}
		if !actor.Role.AtLeast(target.Role) {
			return false, ErrInsufficientRoleToRemoveMember
		}
	}

	if err := s.repositories.GroupMember.Remove(ctx, groupID, userID); err != nil {
		return false, fmt.Errorf("remove group member: %w", err)
	}
	return true, nil
}

func (s *GroupService) List(ctx context.Context) ([]*model.GroupSummaryItem, error) {
	userID, err := platform.CurrentUserID(ctx)
	if err != nil {
		return nil, err
	}

	groups, err := s.repositories.Group.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}

	result := make([]*model.GroupSummaryItem, 0, len(groups))
	for i := range groups {
		count, err := s.repositories.GroupMember.CountByGroup(ctx, groups[i].ID)
		if err != nil {
			return nil, fmt.Errorf("count group members: %w", err)
		}
		result = append(result, mapper.ToModelGroupSummaryItem(&groups[i], count))
	}
	return result, nil
}

func (s *GroupService) Get(ctx context.Context, groupID uuid.UUID) (*model.Group, error) {
	g, err := s.repositories.Group.GetByID(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("load group %s: %w", groupID, err)
	}
	return s.loadGroupModel(ctx, g)
}

// loadGroupModel assembles a full model.Group (with its member list) from a
// domain Group.
func (s *GroupService) loadGroupModel(ctx context.Context, g *group.Group) (*model.Group, error) {
	members, err := s.repositories.GroupMember.ListByGroup(ctx, g.ID)
	if err != nil {
		return nil, fmt.Errorf("list group members: %w", err)
	}

	modelMembers := make([]*model.GroupMember, 0, len(members))
	for i := range members {
		u, err := s.repositories.User.GetByID(ctx, members[i].UserID)
		if err != nil {
			return nil, fmt.Errorf("load member user %s: %w", members[i].UserID, err)
		}
		modelMembers = append(modelMembers, mapper.ToModelGroupMember(&members[i], mapper.ToModelUser(u)))
	}

	return &model.Group{
		ID:      g.ID,
		Name:    g.Name,
		Members: modelMembers,
	}, nil
}
