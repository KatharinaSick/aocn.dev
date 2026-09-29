# The build context is api/, so go.mod and config.yaml are at its root.

FROM golang:1.27-alpine AS build

WORKDIR /src

# Dependencies first. They change far less often than the source, so this layer
# survives most rebuilds.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Static: the runtime image has no libc for a cgo-linked binary to find.
# -trimpath keeps build machine paths out of panic traces.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api-server ./cmd/api-server

# distroless/static has no shell and no package manager, so a bug in the API cannot
# be escalated with tools that happen to be lying around. It does carry CA
# certificates, which the OTLP exporter needs once an endpoint is configured.
FROM gcr.io/distroless/static-debian12:nonroot

# app.ParseConfig reads ./config.yaml relative to the working directory.
WORKDIR /app
COPY --from=build /out/api-server ./api-server
COPY --from=build /src/config.yaml ./config.yaml

USER nonroot:nonroot

# No EXPOSE: Cloud Run injects PORT and the server reads it through config.yaml.
ENTRYPOINT ["/app/api-server"]
