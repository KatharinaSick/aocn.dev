package email

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type call struct {
	method, path string
	body         map[string]any
}

// fakeResend records calls and answers each with the status registered for its
// "METHOD /path", 200 otherwise.
func fakeResend(t *testing.T, statuses map[string]int) (*Client, *[]call) {
	t.Helper()
	var calls []call
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer re_test" {
			t.Errorf("Authorization = %q", got)
		}
		c := call{method: r.Method, path: r.URL.EscapedPath()}
		json.NewDecoder(r.Body).Decode(&c.body)
		calls = append(calls, c)

		if status, ok := statuses[r.Method+" "+r.URL.EscapedPath()]; ok {
			w.WriteHeader(status)
		}
	}))
	t.Cleanup(srv.Close)

	c := NewClient("re_test", "Advent of Cloud Native <noreply@aocn.dev>", "seg_1")
	c.baseURL = srv.URL
	return c, &calls
}

func paths(calls []call) []string {
	var out []string
	for _, c := range calls {
		out = append(out, c.method+" "+c.path)
	}
	return out
}

func TestAddSubscriberCreatesUnknownContacts(t *testing.T) {
	c, calls := fakeResend(t, map[string]int{"PATCH /contacts/a+b@example.com": http.StatusNotFound})

	if err := c.AddSubscriber(context.Background(), "a+b@example.com"); err != nil {
		t.Fatalf("AddSubscriber: %v", err)
	}

	want := []string{"PATCH /contacts/a+b@example.com", "POST /contacts"}
	if got := paths(*calls); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("calls = %v, want %v", got, want)
	}
	created := (*calls)[1].body
	if created["email"] != "a+b@example.com" || created["unsubscribed"] != false {
		t.Errorf("created %v", created)
	}
	if segments, _ := created["segments"].([]any); len(segments) != 1 || segments[0].(map[string]any)["id"] != "seg_1" {
		t.Errorf("segments = %v, want [{id: seg_1}]", created["segments"])
	}
}

// Someone who unsubscribed and confirms again is asking again: they are resubscribed
// and put (back) into the segment.
func TestAddSubscriberResubscribesKnownContacts(t *testing.T) {
	c, calls := fakeResend(t, nil)

	if err := c.AddSubscriber(context.Background(), "player@example.com"); err != nil {
		t.Fatalf("AddSubscriber: %v", err)
	}

	want := []string{"PATCH /contacts/player@example.com", "POST /contacts/player@example.com/segments/seg_1"}
	if got := paths(*calls); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("calls = %v, want %v", got, want)
	}
	if (*calls)[0].body["unsubscribed"] != false {
		t.Errorf("update body = %v, want unsubscribed: false", (*calls)[0].body)
	}
}

func TestSendSubscribeConfirmation(t *testing.T) {
	c, calls := fakeResend(t, nil)

	link := "https://aocn.dev/subscribe/confirm?token=abc&x=1"
	if err := c.SendSubscribeConfirmation(context.Background(), "player@example.com", link); err != nil {
		t.Fatalf("SendSubscribeConfirmation: %v", err)
	}

	sent := (*calls)[0]
	if sent.method+" "+sent.path != "POST /emails" {
		t.Fatalf("call = %s %s", sent.method, sent.path)
	}
	if !strings.Contains(sent.body["text"].(string), link) {
		t.Error("text part does not contain the link")
	}
	if !strings.Contains(sent.body["html"].(string), `href="https://aocn.dev/subscribe/confirm?token=abc&amp;x=1"`) {
		t.Error("html part does not contain the escaped link")
	}
}

func TestQuotaErrors(t *testing.T) {
	c, _ := fakeResend(t, map[string]int{"POST /emails": http.StatusTooManyRequests})

	err := c.SendSubscribeConfirmation(context.Background(), "player@example.com", "https://aocn.dev")
	if !errors.Is(err, ErrQuotaExceeded) {
		t.Errorf("err = %v, want %v", err, ErrQuotaExceeded)
	}
}

func TestErrorsLeaveTheAddressOut(t *testing.T) {
	c, _ := fakeResend(t, map[string]int{"PATCH /contacts/player@example.com": http.StatusInternalServerError})

	err := c.AddSubscriber(context.Background(), "player@example.com")
	if err == nil {
		t.Fatal("no error")
	}
	if strings.Contains(err.Error(), "player@example.com") {
		t.Errorf("error %q contains the address, which would end up in logs", err)
	}
}
