package app

import (
	"os"

	"gopkg.in/yaml.v3"
)

// defaultServerPort is used when PORT is not set, which is the case locally.
// Cloud Run always sets it.
const defaultServerPort = "8080"

type Config struct {
	Server struct {
		Port string `yaml:"port"`
	} `yaml:"server"`
}

// ParseConfig reads ./config.yaml relative to the working directory, so the API must
// be started from the api/ directory. `devbox run api` does that; so does the
// container, which copies the file next to the binary.
func ParseConfig() (*Config, error) {
	data, err := os.ReadFile("./config.yaml")
	if err != nil {
		return nil, err
	}

	cfg := &Config{}
	if err := yaml.Unmarshal([]byte(os.ExpandEnv(string(data))), cfg); err != nil {
		return nil, err
	}

	if cfg.Server.Port == "" {
		cfg.Server.Port = defaultServerPort
	}

	return cfg, nil
}
