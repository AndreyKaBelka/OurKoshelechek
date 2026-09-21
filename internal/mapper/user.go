package mapper

import (
	"OurKoshelechek/graph/model"
	"OurKoshelechek/internal/domain/user"
)

func ToModelUser(u *user.User) *model.User {
	return &model.User{
		ID:       u.ID,
		Username: u.Username,
	}
}

func ToDomainUser(m *model.User) *user.User {
	return &user.User{
		ID:       m.ID,
		Username: m.Username,
	}
}
