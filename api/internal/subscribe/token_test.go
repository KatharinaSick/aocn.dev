package subscribe

import (
	"errors"
	"strings"
	"testing"
	"time"
)

var (
	key  = []byte("test-signing-key")
	now  = time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)
	addr = "player@example.com"
	req  = Request{Email: addr, RequestedAt: now.Add(-time.Hour)}
)

func requestFor(email string) Request {
	return Request{Email: email, RequestedAt: now.Add(-time.Hour)}
}

func TestVerifyReturnsTheSignedRequest(t *testing.T) {
	token := Sign(key, req, now.Add(time.Hour))

	got, err := Verify(key, token, now)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if got.Email != addr {
		t.Errorf("email = %q, want %q", got.Email, addr)
	}
	if !got.RequestedAt.Equal(req.RequestedAt) {
		t.Errorf("requested at = %v, want %v", got.RequestedAt, req.RequestedAt)
	}
}

func TestTokenIsURLSafe(t *testing.T) {
	token := Sign(key, requestFor("a+b/c=d@example.com"), now.Add(time.Hour))
	if strings.ContainsAny(token, "+/=?&# ") {
		t.Errorf("token %q contains characters that need escaping in a URL", token)
	}
}

func TestVerifyRejectsExpiredTokens(t *testing.T) {
	expires := now.Add(time.Hour)
	token := Sign(key, req, expires)

	for name, at := range map[string]time.Time{
		"at expiry":    expires,
		"after expiry": expires.Add(time.Second),
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := Verify(key, token, at); !errors.Is(err, ErrExpiredToken) {
				t.Errorf("err = %v, want %v", err, ErrExpiredToken)
			}
		})
	}
}

// The case that matters most: a token for one address must not be turned into a token
// for another, which would let anyone subscribe a stranger.
func TestVerifyRejectsTamperedTokens(t *testing.T) {
	token := Sign(key, req, now.Add(time.Hour))
	payloadPart, sigPart, _ := strings.Cut(token, ".")
	otherPayload, _, _ := strings.Cut(Sign(key, requestFor("victim@example.com"), now.Add(time.Hour)), ".")
	laterPayload, _, _ := strings.Cut(Sign(key, req, now.Add(365*24*time.Hour)), ".")

	cases := map[string]string{
		"payload swapped for another address": otherPayload + "." + sigPart,
		"expiry pushed back":                  laterPayload + "." + sigPart,
		"signature changed":                   payloadPart + "." + flipFirst(sigPart),
		"signature missing":                   payloadPart + ".",
		"no separator":                        payloadPart + sigPart,
		"empty":                               "",
		"signed with another key":             Sign([]byte("other-key"), req, now.Add(time.Hour)),
		"signature not base64":                payloadPart + ".!!!",
	}
	for name, tampered := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Verify(key, tampered, now); !errors.Is(err, ErrInvalidToken) {
				t.Errorf("err = %v, want %v", err, ErrInvalidToken)
			}
		})
	}
}

func TestVerifyRejectsSignedPayloadsThatAreNotTokens(t *testing.T) {
	for name, encoded := range map[string]string{
		"not base64": "!!!",
		"not JSON":   encoding.EncodeToString([]byte("hello")),
		"no address": encoding.EncodeToString([]byte(`{"x":9999999999}`)),
	} {
		t.Run(name, func(t *testing.T) {
			token := encoded + "." + encoding.EncodeToString(mac(key, encoded))
			if _, err := Verify(key, token, now); !errors.Is(err, ErrInvalidToken) {
				t.Errorf("err = %v, want %v", err, ErrInvalidToken)
			}
		})
	}
}

// flipFirst changes the first character. The last one would not do: its low bits are
// padding, so some changes there decode to the same bytes.
func flipFirst(s string) string {
	replacement := "A"
	if s[0] == 'A' {
		replacement = "B"
	}
	return replacement + s[1:]
}

func TestAddressHash(t *testing.T) {
	if string(AddressHash(key, addr)) != string(AddressHash(key, addr)) {
		t.Error("same address and key hash differently")
	}
	if string(AddressHash(key, addr)) == string(AddressHash(key, "other@example.com")) {
		t.Error("different addresses hash the same")
	}
	if string(AddressHash(key, addr)) == string(AddressHash([]byte("other-key"), addr)) {
		t.Error("the hash does not depend on the key")
	}
}
