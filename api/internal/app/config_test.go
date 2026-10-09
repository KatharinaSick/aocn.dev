package app

import "testing"

func fullConfig() Config {
	var c Config
	c.Database.URL = "postgres://localhost/aocn"
	c.Resend.APIKey = "re_test"
	c.Resend.SegmentID = "seg_1"
	c.Subscribe.SigningKey = "key"
	return c
}

// Without dev mode, a missing secret must stop the API, wherever it runs: falling back
// would accept signups that never send an email.
func TestValidateRequiresSecretsOutsideDevMode(t *testing.T) {
	cases := map[string]func(*Config){
		"no api key":     func(c *Config) { c.Resend.APIKey = "" },
		"no segment":     func(c *Config) { c.Resend.SegmentID = "" },
		"no signing key": func(c *Config) { c.Subscribe.SigningKey = "" },
		"no database":    func(c *Config) { c.Database.URL = "" },
	}
	for name, change := range cases {
		for _, onCloudRun := range []bool{true, false} {
			t.Run(name, func(t *testing.T) {
				c := fullConfig()
				change(&c)
				if err := c.validate(onCloudRun); err == nil {
					t.Errorf("onCloudRun=%v: no error", onCloudRun)
				}
			})
		}
	}

	c := fullConfig()
	if err := c.validate(true); err != nil {
		t.Errorf("complete config: %v", err)
	}
}

func TestValidateDevMode(t *testing.T) {
	var empty Config
	empty.Dev = true
	if err := empty.validate(false); err == nil {
		t.Error("dev mode without a database accepted")
	}

	empty.Database.URL = "postgres://localhost/aocn"
	if err := empty.validate(false); err != nil {
		t.Errorf("dev mode without secrets: %v", err)
	}

	if err := empty.validate(true); err == nil {
		t.Error("dev mode accepted on Cloud Run")
	}

	keyOnly := empty
	keyOnly.Resend.APIKey = "re_test"
	if err := keyOnly.validate(false); err == nil {
		t.Error("dev mode with an API key but no segment accepted")
	}
}
