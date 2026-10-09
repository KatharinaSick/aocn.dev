// Package email talks to Resend: one-off emails, and the contact list the door emails
// are broadcast to.
package email

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const resendAPIURL = "https://api.resend.com"

// ErrQuotaExceeded means Resend refused because a sending limit was reached: the free
// plan allows 100 emails a day. The caller should ask the person to try again later.
var ErrQuotaExceeded = errors.New("resend quota exceeded")

var errNotFound = errors.New("not found")

type Client struct {
	baseURL     string
	apiKey      string
	fromAddress string
	segmentID   string
	httpClient  *http.Client
}

func NewClient(apiKey, fromAddress, segmentID string) *Client {
	return &Client{
		baseURL:     resendAPIURL,
		apiKey:      apiKey,
		fromAddress: fromAddress,
		segmentID:   segmentID,
		httpClient:  &http.Client{Timeout: 10 * time.Second},
	}
}

type sendEmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

// SendSubscribeConfirmation asks the owner of an address to confirm they want door
// emails. Nothing is stored until they do.
//
// Written plainly rather than in POLARIS-7's voice: whoever gets it signed up a minute
// ago and has not met her yet. It has to be recognisable, say what they signed up for
// and offer one button. She only signs it.
func (c *Client) SendSubscribeConfirmation(ctx context.Context, to, confirmURL string) error {
	body, err := renderConfirmationHTML(confirmURL)
	if err != nil {
		return err
	}
	return c.do(ctx, http.MethodPost, "/emails", sendEmailRequest{
		From:    c.fromAddress,
		To:      []string{to},
		Subject: "Confirm your email for Advent of Cloud Native",
		HTML:    body,
		Text:    fmt.Sprintf(confirmationText, confirmURL),
	})
}

const confirmationText = `Hi,

You signed up for Advent of Cloud Native: one email whenever a new door opens, each with a CNCF maintainer interview and a hands-on challenge.

Confirm your email to get them:
%s

The link works for 24 hours. If you did not sign up, ignore this email and nothing else will arrive.

See you in December.
POLARIS-7, station AI
https://aocn.dev`

// The website's look, as far as mail clients allow: tables and inline styles only, since
// most ignore stylesheets. Colors are base.css's tokens as hex (bg, line, text,
// text-body, text-soft, muted, aurora); emails cannot read CSS variables. The font
// stack names JetBrains Mono for those who have it installed and falls back to the
// system monospace; the site's self-hosted file is not loaded from an email.
//
// color-scheme declares the email dark, so mail apps in dark mode leave it alone
// instead of inverting it.
var confirmationHTML = template.Must(template.New("confirmation").Parse(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Confirm your email for Advent of Cloud Native</title>
</head>
<body style="margin:0;padding:0;background:#0a1114">
<div style="display:none;max-height:0;overflow:hidden">Confirm your email to get one email whenever a door opens.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a1114" style="background:#0a1114">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:14px;line-height:1.7;color:#c2d4ce">
  <tr><td style="padding:0 0 16px;border-bottom:1px solid #1e2e33">
    <img src="https://aocn.dev/favicon.png" width="24" height="24" alt="" style="border:0;vertical-align:middle">
    <span style="vertical-align:middle;color:#d5e4df;font-weight:bold">&nbsp;POLARIS-7</span>
    <span style="vertical-align:middle;color:#7f9a94">&nbsp;// station console</span>
  </td></tr>
  <tr><td style="padding:32px 0 0;color:#7f9a94;font-size:12px;line-height:1.5">$ subscribe --confirm</td></tr>
  <tr><td style="padding:8px 0 0;color:#d5e4df;font-size:28px;line-height:1.1;letter-spacing:-0.02em;font-weight:bold">confirm your email<span style="color:#5ce6a8">_</span></td></tr>
  <tr><td style="padding:24px 0 0">You signed up for Advent of Cloud Native: one email whenever a new door opens, each with a CNCF maintainer interview and a hands-on challenge.</td></tr>
  <tr><td style="padding:24px 0 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td bgcolor="#5ce6a8" style="background:#5ce6a8">
        <a href="{{.URL}}" style="display:inline-block;padding:12px 20px;color:#0a1114;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:14px;font-weight:bold;text-decoration:none">confirm my email</a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 0 0;color:#a9bfb9">The link works for 24 hours. If you did not sign up, ignore this email and nothing else will arrive.</td></tr>
  <tr><td style="padding:16px 0 0;color:#7f9a94;font-size:12px;line-height:1.5;word-break:break-all">Button not working? Open this link:<br><a href="{{.URL}}" style="color:#5ce6a8">{{.URL}}</a></td></tr>
  <tr><td style="padding:32px 0 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:16px 0;border-top:1px solid #1e2e33"><span style="color:#d5e4df;font-weight:bold">POLARIS-7</span> <span style="color:#7f9a94">&gt;</span> See you in December.<span style="color:#5ce6a8"> &#9608;</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="color:#7f9a94;font-size:12px;line-height:1.5"><a href="https://aocn.dev" style="color:#7f9a94">aocn.dev</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`))

func renderConfirmationHTML(confirmURL string) (string, error) {
	var b strings.Builder
	if err := confirmationHTML.Execute(&b, struct{ URL string }{confirmURL}); err != nil {
		return "", err
	}
	return b.String(), nil
}

type createContactRequest struct {
	Email        string           `json:"email"`
	Unsubscribed bool             `json:"unsubscribed"`
	Segments     []segmentRequest `json:"segments"`
}

type segmentRequest struct {
	ID string `json:"id"`
}

type updateContactRequest struct {
	Unsubscribed bool `json:"unsubscribed"`
}

// AddSubscriber puts a confirmed address on the list the door emails go to.
//
// Someone may confirm twice, or come back after unsubscribing, so the contact may
// already exist. Resend does not document what creating an existing contact does, so
// the existing one is updated first and created only when Resend does not know it.
// Confirming again is the person asking again, so it clears an earlier unsubscribe.
func (c *Client) AddSubscriber(ctx context.Context, address string) error {
	contactPath := "/contacts/" + url.PathEscape(address)

	err := c.do(ctx, http.MethodPatch, contactPath, updateContactRequest{Unsubscribed: false})
	if errors.Is(err, errNotFound) {
		return c.do(ctx, http.MethodPost, "/contacts", createContactRequest{
			Email:        address,
			Unsubscribed: false,
			Segments:     []segmentRequest{{ID: c.segmentID}},
		})
	}
	if err != nil {
		return err
	}

	return c.do(ctx, http.MethodPost, contactPath+"/segments/"+url.PathEscape(c.segmentID), nil)
}

// do performs one Resend API call, so the HTTP plumbing lives in one place.
func (c *Client) do(ctx context.Context, method, path string, body any) error {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusNotFound:
		return errNotFound
	case resp.StatusCode == http.StatusTooManyRequests:
		return ErrQuotaExceeded
	case resp.StatusCode >= 400:
		// Resend's error body names the problem; the status alone rarely does. The path
		// is left out because it can contain the address, which does not belong in logs.
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("resend %s returned %d: %s", method, resp.StatusCode, bytes.TrimSpace(detail))
	}
	return nil
}
