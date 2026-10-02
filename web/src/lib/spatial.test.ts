import { describe, expect, it } from 'vitest';
import { type Box, pickNext } from './spatial';

const box = (left: number, top: number, width = 100, height = 40): Box => ({ left, top, width, height });

// Roughly the landing page: a nav link top right, the email row, and a menu under the last button.
const nav = box(1000, 20, 100, 20);
const email = box(140, 600, 280, 46);
const notify = box(430, 600, 80, 46);
const calendar = box(520, 600, 130, 46);
const google = box(520, 654, 200, 40);
const other = box(520, 694, 200, 40);
const footer = box(140, 880, 160, 20);
const page = [nav, email, notify, calendar, google, other, footer];

const next = (from: Box, direction: Parameters<typeof pickNext>[2]) => page[pickNext(from, page, direction)];

describe('pickNext', () => {
  it('moves along a row with h and l', () => {
    expect(next(email, 'right')).toBe(notify);
    expect(next(notify, 'right')).toBe(calendar);
    expect(next(calendar, 'left')).toBe(notify);
    expect(next(notify, 'left')).toBe(email);
  });

  it('moves into an open menu below with j, and back up with k', () => {
    expect(next(calendar, 'down')).toBe(google);
    expect(next(google, 'down')).toBe(other);
    expect(next(other, 'up')).toBe(google);
    expect(next(google, 'up')).toBe(calendar);
  });

  it('prefers what is straight ahead over what is closer but off to the side', () => {
    expect(next(email, 'down')).toBe(footer);
    expect(next(email, 'up')).toBe(nav);
  });

  it('keeps h and l within the row', () => {
    // The footer link is further left than the email field, but on another row.
    expect(pickNext(email, page, 'left')).toBe(-1);
    expect(pickNext(google, page, 'right')).toBe(-1);
  });

  it('returns -1 when there is nothing in that direction', () => {
    expect(pickNext(email, page, 'left')).toBe(-1);
    expect(pickNext(nav, page, 'up')).toBe(-1);
  });

  it('never picks the element it starts from', () => {
    expect(pickNext(email, [email], 'down')).toBe(-1);
  });
});
