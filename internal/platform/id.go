package platform

import "github.com/google/uuid"

// NewID generates a new entity ID as a UUIDv7: time-ordered, so ids created
// later sort after ids created earlier even when compared as plain strings/bytes
// (unlike the random v4 ids uuid.New returns). Domain constructors that take an
// id should be called with NewID() rather than uuid.New() for anything the app
// itself creates.
func NewID() uuid.UUID {
	return uuid.Must(uuid.NewV7())
}
