package mapper

import (
	"time"

	"github.com/google/uuid"

	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/group"
)

func ToModelGroup(g *group.Group) *model.Group {
	return &model.Group{
		ID:   g.ID,
		Name: g.Name,
	}
}

func ToDomainGroup(m *model.Group) *group.Group {
	return &group.Group{
		ID:   m.ID,
		Name: m.Name,
	}
}

func ToModelGroupSummaryItem(g *group.Group, membersCount int) *model.GroupSummaryItem {
	return &model.GroupSummaryItem{
		ID:           g.ID,
		Name:         g.Name,
		MembersCount: membersCount,
	}
}

// ToModelGroupRole возвращает nil для ролей, не представленных в GraphQL-схеме (RoleReader).
func ToModelGroupRole(r group.Role) *model.GroupRole {
	switch r {
	case group.RoleOwner:
		v := model.GroupRoleOwner
		return &v
	case group.RoleMember:
		v := model.GroupRoleMember
		return &v
	default:
		return nil
	}
}

func ToDomainGroupRole(r model.GroupRole) group.Role {
	switch r {
	case model.GroupRoleOwner:
		return group.RoleOwner
	case model.GroupRoleMember:
		return group.RoleMember
	default:
		return group.RoleReader
	}
}

func ToModelGroupMember(m *group.Member, u *model.User) *model.GroupMember {
	return &model.GroupMember{
		User: u,
		Role: ToModelGroupRole(m.Role),
	}
}

func ToDomainGroupMember(m *model.GroupMember, groupID uuid.UUID, joinedAt time.Time) *group.Member {
	gm := &group.Member{
		GroupID:  groupID,
		Role:     group.RoleReader,
		JoinedAt: joinedAt,
	}
	if m.User != nil {
		gm.UserID = m.User.ID
	}
	if m.Role != nil {
		gm.Role = ToDomainGroupRole(*m.Role)
	}
	return gm
}
