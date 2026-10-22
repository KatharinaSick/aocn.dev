// Package schedule reads schedule.yaml at the repository root, the one place a date
// lives: when each door opens. The website reads the same file (web/src/lib/schedule.ts)
// and must accept and reject exactly what this does; the shared files in testdata/ at
// the repository root check that.
//
// Dates are decoded as strings and checked here, never left to the YAML decoder: a
// date needs a date, a time and an offset, or it is rejected.
package schedule

import (
	"bytes"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"time"

	"gopkg.in/yaml.v3"
)

// The same pattern as on the website: seconds, no fractions, and Z or a ±HH:MM offset.
var datePattern = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-](\d{2}):(\d{2}))$`)

// file is schedule.yaml as written. Doors are nodes rather than strings because yaml.v3
// silently drops a null item from a []string, which would move every later door up by one.
type file struct {
	Doors        []yaml.Node `yaml:"doors"`
	ChristmasEve struct {
		BeforeSeason string `yaml:"beforeSeason"`
		Finale       string `yaml:"finale"`
	} `yaml:"christmasEve"`
}

// Schedule says when each door opens. Every method takes now instead of reading the
// clock, so the schedule can be tested at any moment.
type Schedule struct {
	doors []time.Time

	// The moments POLARIS-7's incident counter on the website counts from. Nothing in
	// the API uses them; they are read so a broken one is rejected here too.
	christmasEveBeforeSeason time.Time
	christmasEveFinale       time.Time
}

// Load reads and checks the schedule at path.
func Load(path string) (*Schedule, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	s, err := Parse(data)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return s, nil
}

// Parse checks a schedule. The error names the door or key that is wrong.
func Parse(data []byte) (*Schedule, error) {
	var f file
	decoder := yaml.NewDecoder(bytes.NewReader(data))
	// A misspelled or invented key is an error, not something to ignore.
	decoder.KnownFields(true)
	if err := decoder.Decode(&f); err != nil {
		return nil, err
	}

	if len(f.Doors) == 0 {
		return nil, fmt.Errorf("doors: must be a list with at least one date")
	}

	s := &Schedule{doors: make([]time.Time, len(f.Doors))}
	for i, node := range f.Doors {
		label := fmt.Sprintf("door %d", i+1)
		if node.Kind != yaml.ScalarNode {
			return nil, fmt.Errorf("%s: not a date", label)
		}
		text := node.Value
		if node.Tag == "!!null" {
			text = ""
		}
		opensAt, err := parseDate(text, label)
		if err != nil {
			return nil, err
		}
		if i > 0 && !opensAt.After(s.doors[i-1]) {
			return nil, fmt.Errorf("door %d: opens at %s, not after door %d", i+1, text, i)
		}
		s.doors[i] = opensAt
	}

	var err error
	if s.christmasEveBeforeSeason, err = parseDate(f.ChristmasEve.BeforeSeason, "christmasEve.beforeSeason"); err != nil {
		return nil, err
	}
	if s.christmasEveFinale, err = parseDate(f.ChristmasEve.Finale, "christmasEve.finale"); err != nil {
		return nil, err
	}
	return s, nil
}

func parseDate(text, label string) (time.Time, error) {
	if text == "" {
		return time.Time{}, fmt.Errorf("%s: missing date", label)
	}

	match := datePattern.FindStringSubmatch(text)
	if match == nil {
		return time.Time{}, fmt.Errorf(`%s: "%s" needs a date, a time and an offset, like 2026-12-01T06:00:00+01:00`, label, text)
	}

	t, err := time.Parse(time.RFC3339, text)
	if err != nil || !offsetInRange(match) {
		return time.Time{}, fmt.Errorf(`%s: "%s" is not a valid date`, label, text)
	}
	return t, nil
}

// offsetInRange checks the ±HH:MM offset, which time.Parse does not bound as tightly
// as the website does.
func offsetInRange(match []string) bool {
	if match[7] == "Z" {
		return true
	}
	hours, _ := strconv.Atoi(match[8])
	minutes, _ := strconv.Atoi(match[9])
	return hours <= 23 && minutes <= 59
}

// Doors is how many doors there are: the length of the list in schedule.yaml.
func (s *Schedule) Doors() int {
	return len(s.doors)
}

// OpensAt is when a door opens. Doors are numbered from 1.
func (s *Schedule) OpensAt(door int) (time.Time, error) {
	if door < 1 || door > len(s.doors) {
		return time.Time{}, fmt.Errorf("there is no door %d; doors are numbered 1 to %d", door, len(s.doors))
	}
	return s.doors[door-1], nil
}

// IsOpen reports whether a door is open at now. This decides whether a door's content
// may be served: anything about a door that is not open must not be.
func (s *Schedule) IsOpen(door int, now time.Time) (bool, error) {
	opensAt, err := s.OpensAt(door)
	if err != nil {
		return false, err
	}
	return !now.Before(opensAt), nil
}

// Next is the next door to open after now and when. ok is false once every door is open.
func (s *Schedule) Next(now time.Time) (door int, opensAt time.Time, ok bool) {
	for i, t := range s.doors {
		if t.After(now) {
			return i + 1, t, true
		}
	}
	return 0, time.Time{}, false
}
