package api

import (
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	cases := map[string]struct {
		forwarded, remote, want string
	}{
		"first forwarded entry": {"198.51.100.7, 10.0.0.1", "10.0.0.2:1234", "198.51.100.7"},
		"no forwarded header":   {"", "192.0.2.4:5678", "192.0.2.4"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/", nil)
			req.RemoteAddr = tc.remote
			if tc.forwarded != "" {
				req.Header.Set("X-Forwarded-For", tc.forwarded)
			}
			if got := clientIP(req); got != tc.want {
				t.Errorf("clientIP = %q, want %q", got, tc.want)
			}
		})
	}
}
