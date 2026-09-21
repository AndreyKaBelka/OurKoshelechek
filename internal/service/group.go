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

// Create makes a new group and adds ownerID as its owner member, atomically.
func (s *GroupService) Create(ctx context.Context, ownerID uuid.UUID, input model.CreateGroupInput) (*model.Group, error) {
	now := time.Now()
	g, err := group.NewGroup(uuid.New(), input.Name, now, now)
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

func (s *GroupService) RemoveMember(ctx context.Context, groupID, userID uuid.UUID) (bool, error) {
	if err := s.repositories.GroupMember.Remove(ctx, groupID, userID); err != nil {
		return false, fmt.Errorf("remove group member: %w", err)
	}
	return true, nil
}

func (s *GroupService) List(ctx context.Context, userID uuid.UUID) ([]*model.GroupSummaryItem, error) {
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
