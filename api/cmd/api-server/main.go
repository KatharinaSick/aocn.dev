package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/katharinasick/aocn.dev/api/internal/api"
	"github.com/katharinasick/aocn.dev/api/internal/app"
)

// shutdownTimeout bounds how long in-flight requests and the final span export get
// after SIGTERM. Cloud Run allows 10s by default before killing the container.
const shutdownTimeout = 8 * time.Second

func main() {
	log := app.NewLogger()

	// Cloud Run signals shutdown with SIGTERM. Catching it is what allows buffered
	// spans to be flushed instead of lost.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := app.ParseConfig()
	if err != nil {
		log.Error("Failed to parse config. Terminating.", "error", err)
		os.Exit(1)
	}

	shutdownOTel, err := app.SetupOTel(ctx, log)
	if err != nil {
		log.Error("Failed to set up OpenTelemetry. Terminating.", "error", err)
		os.Exit(1)
	}

	httpServer := &http.Server{
		Addr:         net.JoinHostPort("", cfg.Server.Port),
		Handler:      api.NewHandler(log),
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		log.Info("Starting server", "address", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		log.Error("Server failed. Terminating.", "error", err)
		flush(log, shutdownOTel)
		os.Exit(1)
	case <-ctx.Done():
		log.Info("Shutdown signal received")
	}

	// Stop accepting connections and let in-flight requests finish before the
	// spans they produced are exported.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Error("Server did not shut down cleanly", "error", err)
	}
	flush(log, shutdownOTel)
	log.Info("Shutdown complete")
}

func flush(log app.Logger, shutdownOTel func(context.Context) error) {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := shutdownOTel(ctx); err != nil {
		log.Error("Failed to flush telemetry", "error", err)
	}
}
