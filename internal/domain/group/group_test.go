package group

import "testing"

func TestRole_AtLeast(t *testing.T) {
	tests := []struct {
		name string
		role Role
		min  Role
		want bool
	}{
		{"owner at least reader", RoleOwner, RoleReader, true},
		{"owner at least member", RoleOwner, RoleMember, true},
		{"owner at least owner", RoleOwner, RoleOwner, true},
		{"member at least reader", RoleMember, RoleReader, true},
		{"member at least member", RoleMember, RoleMember, true},
		{"member at least owner", RoleMember, RoleOwner, false},
		{"reader at least reader", RoleReader, RoleReader, true},
		{"reader at least member", RoleReader, RoleMember, false},
		{"reader at least owner", RoleReader, RoleOwner, false},
		{"invalid role at least reader", Role("bogus"), RoleReader, true},
		{"invalid role at least member", Role("bogus"), RoleMember, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.AtLeast(tt.min); got != tt.want {
				t.Errorf("%q.AtLeast(%q) = %v, want %v", tt.role, tt.min, got, tt.want)
			}
		})
	}
}
