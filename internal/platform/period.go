package platform

import (
	"errors"
	"time"
)

// ErrInvalidPeriod is returned by ParsePeriod for a period argument that
// isn't in "YYYY-MM" format.
var ErrInvalidPeriod = errors.New("period must be in YYYY-MM format")

// ParsePeriod parses a "YYYY-MM" period (as used by the budget/summary
// queries) into a half-open UTC date range [from, to) spanning that month.
func ParsePeriod(period string) (from, to time.Time, err error) {
	from, err = time.Parse("2006-01", period)
	if err != nil {
		return time.Time{}, time.Time{}, ErrInvalidPeriod
	}
	return from, from.AddDate(0, 1, 0), nil
}
