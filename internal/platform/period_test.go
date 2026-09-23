package platform

import (
	"errors"
	"testing"
	"time"
)

func TestParseDateRange(t *testing.T) {
	from, to, err := ParseDateRange("2026-09-08", "2026-09-18")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if want := time.Date(2026, 9, 8, 0, 0, 0, 0, time.UTC); !from.Equal(want) {
		t.Errorf("from = %v, want %v", from, want)
	}
	if want := time.Date(2026, 9, 19, 0, 0, 0, 0, time.UTC); !to.Equal(want) {
		t.Errorf("to = %v, want %v (dateTo is inclusive)", to, want)
	}

	for _, tc := range [][2]string{{"2026-09-18", "2026-09-08"}, {"08.09.2026", "2026-09-18"}, {"2026-09-08", ""}} {
		if _, _, err := ParseDateRange(tc[0], tc[1]); !errors.Is(err, ErrInvalidDateRange) {
			t.Errorf("ParseDateRange(%q, %q) err = %v, want ErrInvalidDateRange", tc[0], tc[1], err)
		}
	}
}
