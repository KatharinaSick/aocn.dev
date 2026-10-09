// Package subscribe holds the rules of the email signup that can be tested without a
// mail provider: the token in the confirmation link.
package subscribe

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("expired token")
)

// The token carries the address, when it was asked for and when the link expires,
// rather than an id, so confirming needs no stored state: whoever holds a validly
// signed token has read that inbox.
type payload struct {
	Email     string `json:"e"`
	Requested int64  `json:"r"`
	Expires   int64  `json:"x"`
}

// Request is what a valid token says: who asked, and when.
type Request struct {
	Email       string
	RequestedAt time.Time
}

var encoding = base64.RawURLEncoding

// Sign returns a URL-safe token for a request that verifies until expires: the payload
// and its HMAC-SHA256, each base64url-encoded and joined by a dot.
func Sign(key []byte, req Request, expires time.Time) string {
	data, _ := json.Marshal(payload{Email: req.Email, Requested: req.RequestedAt.Unix(), Expires: expires.Unix()}) // cannot fail for this struct
	encoded := encoding.EncodeToString(data)
	return encoded + "." + encoding.EncodeToString(mac(key, encoded))
}

// Verify returns the request a token was signed for. The signature is checked before
// the payload is decoded, so nothing an attacker wrote is parsed.
func Verify(key []byte, token string, now time.Time) (Request, error) {
	encoded, sig, ok := strings.Cut(token, ".")
	if !ok {
		return Request{}, ErrInvalidToken
	}

	gotMAC, err := encoding.DecodeString(sig)
	if err != nil || !hmac.Equal(gotMAC, mac(key, encoded)) {
		return Request{}, ErrInvalidToken
	}

	data, err := encoding.DecodeString(encoded)
	if err != nil {
		return Request{}, ErrInvalidToken
	}
	var p payload
	if err := json.Unmarshal(data, &p); err != nil || p.Email == "" {
		return Request{}, ErrInvalidToken
	}

	if !now.Before(time.Unix(p.Expires, 0)) {
		return Request{}, ErrExpiredToken
	}
	return Request{Email: p.Email, RequestedAt: time.Unix(p.Requested, 0)}, nil
}

// AddressHash identifies an address without storing it: an HMAC under the signing key,
// so the hash cannot be reversed by hashing guessed addresses without the key. The
// prefix keeps it from ever equalling a token signature, whose input is base64.
func AddressHash(key []byte, email string) []byte {
	return mac(key, "address:"+email)
}

func mac(key []byte, message string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(message))
	return h.Sum(nil)
}
