package app

import (
	"log/slog"
	"os"
)

type Logger interface {
	Debug(msg string, args ...any)
	Info(msg string, args ...any)
	Warn(msg string, args ...any)
	Error(msg string, args ...any)
}

// NewLogger writes JSON to stdout, which is what Cloud Run parses into structured
// log entries.
func NewLogger() Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, nil))
}
