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

// ErrInvalidDateRange is returned by ParseDateRange for dates that aren't in
// "YYYY-MM-DD" format or a range whose start is after its end.
var ErrInvalidDateRange = errors.New("date range must be YYYY-MM-DD dates with dateFrom not after dateTo")

// ParseDateRange parses an inclusive "YYYY-MM-DD" day range into a half-open
// UTC range [from, to), to+1 day, matching ParsePeriod's month boundaries.
func ParseDateRange(dateFrom, dateTo string) (from, to time.Time, err error) {
	from, err = time.Parse(time.DateOnly, dateFrom)
	if err != nil {
		return time.Time{}, time.Time{}, ErrInvalidDateRange
	}
	last, err := time.Parse(time.DateOnly, dateTo)
	if err != nil || last.Before(from) {
		return time.Time{}, time.Time{}, ErrInvalidDateRange
	}
	return from, last.AddDate(0, 0, 1), nil
}
