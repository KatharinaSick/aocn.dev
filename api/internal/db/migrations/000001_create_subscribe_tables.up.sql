-- Confirmation emails sent, for the per-address limit. A keyed hash rather than the
-- address, so the addresses of people who never confirmed are not kept in readable
-- form. Rows older than the limit's window are deleted as new requests come in.
CREATE TABLE subscribe_requests (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    address_hash BYTEA       NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX subscribe_requests_address_hash_requested_at ON subscribe_requests (address_hash, requested_at);

-- Proof of consent: every confirmed double opt-in, as a log. Who is subscribed right
-- now is Resend's to know, since unsubscribing happens there.
CREATE TABLE subscribe_confirmations (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email        TEXT        NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX subscribe_confirmations_email ON subscribe_confirmations (email);
