package app

import (
	"context"
	"fmt"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

const defaultServiceName = "aocn-api"

// SetupOTel installs a global tracer provider and returns a shutdown function that
// flushes buffered spans. The caller must invoke it before exiting or the spans
// recorded since the last export are lost.
//
// Everything is configured through the standard OTEL_* environment variables, so no
// backend is named in code: pointing this at Dynatrace means setting
// OTEL_EXPORTER_OTLP_ENDPOINT and an OTEL_EXPORTER_OTLP_HEADERS entry carrying the
// API token. With no endpoint configured, spans go to stdout instead, which keeps
// local development and tests independent of any collector.
func SetupOTel(ctx context.Context, log Logger) (func(context.Context) error, error) {
	// The SDK reads service.name from OTEL_SERVICE_NAME. Defaulting the variable
	// rather than the resource keeps the environment authoritative, so a deployment
	// can override it without a code change.
	if os.Getenv("OTEL_SERVICE_NAME") == "" {
		if err := os.Setenv("OTEL_SERVICE_NAME", defaultServiceName); err != nil {
			return nil, fmt.Errorf("defaulting OTEL_SERVICE_NAME: %w", err)
		}
	}

	res, err := resource.New(ctx, resource.WithFromEnv(), resource.WithTelemetrySDK())
	if err != nil {
		return nil, fmt.Errorf("building otel resource: %w", err)
	}

	exporterConfigured := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") != "" ||
		os.Getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") != ""

	var spanProcessor sdktrace.TracerProviderOption
	if exporterConfigured {
		exporter, err := otlptracehttp.New(ctx)
		if err != nil {
			return nil, fmt.Errorf("creating otlp trace exporter: %w", err)
		}
		// Batched, because exporting per span would put a network call in the
		// request path.
		spanProcessor = sdktrace.WithBatcher(exporter)
		log.Info("Tracing to OTLP endpoint")
	} else {
		exporter, err := stdouttrace.New()
		if err != nil {
			return nil, fmt.Errorf("creating stdout trace exporter: %w", err)
		}
		// Unbatched, so a span shows up the moment it ends. Only used locally.
		spanProcessor = sdktrace.WithSyncer(exporter)
		log.Info("No OTLP endpoint configured, tracing to stdout")
	}

	provider := sdktrace.NewTracerProvider(spanProcessor, sdktrace.WithResource(res))
	otel.SetTracerProvider(provider)

	// W3C trace context, so a trace started by the website or the CLI continues here
	// rather than beginning again.
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return provider.Shutdown, nil
}
