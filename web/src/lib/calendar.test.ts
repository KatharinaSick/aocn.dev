import { describe, expect, it } from 'vitest';
import { buildCalendar, doorEventUid, foldLine } from './calendar';
import { DOOR_COUNT, doorOpensAt } from './doors';

const site = new URL('https://aocn.dev/');
const generatedAt = new Date('2026-10-01T12:00:00.000Z');
const ics = buildCalendar(site, generatedAt);

/** The calendar with folded lines joined back together. */
const unfolded = ics.replace(/\r\n /g, '');
const events = unfolded.split('BEGIN:VEVENT').slice(1);
const field = (event: string, name: string) => event.match(new RegExp(`^${name}:(.*)\r$`, 'm'))?.[1];

describe('buildCalendar', () => {
  it('is one calendar with one event per door', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(events).toHaveLength(DOOR_COUNT);
  });

  it('starts every event at the exact moment its door opens, and ends it 30 minutes later', () => {
    events.forEach((event, i) => {
      const opensAt = doorOpensAt(i + 1).toISOString().replace(/[-:]/g, '').replace('.000', '');
      expect(field(event, 'DTSTART')).toBe(opensAt);
    });
    expect(field(events[0], 'DTSTART')).toBe('20261201T050000Z');
    expect(field(events[0], 'DTEND')).toBe('20261201T053000Z');
    expect(field(events[11], 'DTSTART')).toBe('20261223T050000Z');
  });

  it('gives every door a stable UID, so subscribed calendars update instead of duplicating', () => {
    expect(events.map((event) => field(event, 'UID'))).toEqual(
      Array.from({ length: DOOR_COUNT }, (_, i) => doorEventUid(i + 1)),
    );
    expect(buildCalendar(site, new Date('2026-11-15T00:00:00Z'))).toContain('UID:door-01@aocn.dev');
  });

  it('names and describes the events without anything about what is behind a door', () => {
    expect(field(events[0], 'SUMMARY')).toBe('aocn · door 01 opens');
    expect(field(events[0], 'DESCRIPTION')).toBe('A new maintainer interview and challenge are up. https://aocn.dev/');
    expect(field(events[0], 'URL')).toBe('https://aocn.dev/');
  });

  it('stamps every event with the time the calendar was generated', () => {
    for (const event of events) expect(field(event, 'DTSTAMP')).toBe('20261001T120000Z');
  });

  it('uses CRLF line endings only', () => {
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('keeps every line within 75 octets', () => {
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('folds long lines without splitting a character', () => {
    // 2-byte characters: a naive 75-character cut would split one and produce garbage.
    const line = 'DESCRIPTION:' + 'ü·'.repeat(60);
    const folded = foldLine(line).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    for (const part of folded.slice(1)) expect(part.startsWith(' ')).toBe(true);
    expect(folded.map((part, i) => (i === 0 ? part : part.slice(1))).join('')).toBe(line);
  });

  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:aocn · door 01 opens')).toBe('SUMMARY:aocn · door 01 opens');
  });
});
