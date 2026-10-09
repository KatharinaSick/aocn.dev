/**
 * The email signup as the website sees it: what to send to the API and what each answer
 * means. Double opt-in: requestSubscription only asks the API to email a confirmation
 * link; confirmSubscription, called from the page that link opens, is what subscribes.
 *
 * Each outcome comes with POLARIS-7's line for it, so the landing page, the man page and
 * the confirmation page say the same thing.
 */

export type RequestOutcome = 'sent' | 'invalid' | 'rateLimited' | 'quota' | 'error';
export type ConfirmOutcome = 'confirmed' | 'expired' | 'invalid' | 'quota' | 'error';

type Fetch = typeof fetch;

/**
 * Asks the API to send a confirmation link. `website` is the honeypot field: empty for
 * people, filled in by bots. The API answers "sent" either way, so a bot cannot tell.
 */
export async function requestSubscription(email: string, website: string, fetchFn: Fetch = fetch): Promise<RequestOutcome> {
  const status = await post(fetchFn, '/api/subscribe', { email, website });
  switch (status) {
    case 202:
      return 'sent';
    case 400:
      return 'invalid';
    case 429:
      return 'rateLimited';
    case 503:
      return 'quota';
    default:
      return 'error';
  }
}

export async function confirmSubscription(token: string, fetchFn: Fetch = fetch): Promise<ConfirmOutcome> {
  const status = await post(fetchFn, '/api/subscribe/confirm', { token });
  switch (status) {
    case 204:
      return 'confirmed';
    case 410:
      return 'expired';
    case 400:
      return 'invalid';
    case 503:
      return 'quota';
    default:
      return 'error';
  }
}

/** The token from the confirmation link's query string, or null if there is none. */
export function tokenFromSearch(search: string): string | null {
  const token = new URLSearchParams(search).get('token')?.trim();
  return token ? token : null;
}

/** The status code, or 0 when the request did not get an answer at all. */
async function post(fetchFn: Fetch, url: string, body: unknown): Promise<number> {
  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.status;
  } catch {
    return 0;
  }
}

export interface Message {
  text: string;
  /** Errors are shown in the error color, as a vim-style message. */
  isError: boolean;
}

export const REQUEST_MESSAGES: Record<RequestOutcome | 'empty', Message> = {
  sent: { text: 'Sent. Confirm with the link in your inbox; it works for 24 hours.', isError: false },
  empty: { text: 'E: no address given.', isError: true },
  invalid: { text: 'E: that is not an email address.', isError: true },
  rateLimited: { text: 'E: too many signups from here. Try again in an hour.', isError: true },
  quota: { text: 'E: I have sent all the email I may send today. Try again tomorrow.', isError: true },
  error: { text: 'E: could not reach the station. Try again later.', isError: true },
};

export const CONFIRM_MESSAGES: Record<ConfirmOutcome | 'missing', Message> = {
  confirmed: { text: 'Confirmed. I will write when a door opens. One email per door, nothing else.', isError: false },
  missing: { text: 'E: this link has no token. Use the whole link from the email.', isError: true },
  expired: { text: 'E: this link has expired. Sign up again and I will send a new one.', isError: true },
  invalid: { text: 'E: this link is broken. Use the whole link from the email, or sign up again.', isError: true },
  quota: { text: 'E: I have sent all the email I may send today. Try again tomorrow.', isError: true },
  error: { text: 'E: could not reach the station. Try again later.', isError: true },
};
