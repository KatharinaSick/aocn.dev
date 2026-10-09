import { describe, expect, it, vi } from 'vitest';
import { confirmSubscription, requestSubscription, tokenFromSearch } from './subscribe';

const answering = (status: number) => vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;
const failing = vi.fn(async () => {
  throw new TypeError('Failed to fetch');
}) as unknown as typeof fetch;

describe('requestSubscription', () => {
  it('posts the address and the honeypot as JSON to the API', async () => {
    const fetchFn = answering(202);
    await requestSubscription('player@example.com', '', fetchFn);

    expect(fetchFn).toHaveBeenCalledWith('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player@example.com', website: '' }),
    });
  });

  it.each([
    [202, 'sent'],
    [400, 'invalid'],
    [429, 'rateLimited'],
    [503, 'quota'],
    [500, 'error'],
    [502, 'error'],
  ])('reads %i as %s', async (status, outcome) => {
    expect(await requestSubscription('player@example.com', '', answering(status))).toBe(outcome);
  });

  it('reads no answer at all as an error', async () => {
    expect(await requestSubscription('player@example.com', '', failing)).toBe('error');
  });
});

describe('confirmSubscription', () => {
  it('posts the token as JSON to the API', async () => {
    const fetchFn = answering(204);
    await confirmSubscription('abc.def', fetchFn);

    expect(fetchFn).toHaveBeenCalledWith('/api/subscribe/confirm', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token: 'abc.def' }),
    }));
  });

  it.each([
    [204, 'confirmed'],
    [410, 'expired'],
    [400, 'invalid'],
    [503, 'quota'],
    [500, 'error'],
  ])('reads %i as %s', async (status, outcome) => {
    expect(await confirmSubscription('abc.def', answering(status))).toBe(outcome);
  });

  // A 2xx other than 204 is not what the API sends on success, so it is not success.
  it('does not read an unexpected success code as confirmed', async () => {
    expect(await confirmSubscription('abc.def', answering(200))).toBe('error');
  });

  it('reads no answer at all as an error', async () => {
    expect(await confirmSubscription('abc.def', failing)).toBe('error');
  });
});

describe('tokenFromSearch', () => {
  it('finds the token in the query string', () => {
    expect(tokenFromSearch('?token=eyJl.abc-_')).toBe('eyJl.abc-_');
  });

  it('decodes an escaped token', () => {
    expect(tokenFromSearch('?token=a%2Eb')).toBe('a.b');
  });

  it.each(['', '?', '?token=', '?token=%20', '?other=1'])('finds none in %j', (search) => {
    expect(tokenFromSearch(search)).toBeNull();
  });
});
