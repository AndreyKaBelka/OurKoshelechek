package mapper

import (
	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/group"
)

func ToModelGroup(g *group.Group) *model.Group {
	return &model.Group{
		ID:   g.ID,
		Name: g.Name,
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
