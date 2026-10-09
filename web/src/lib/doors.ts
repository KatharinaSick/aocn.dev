/**
 * The Advent of Cloud Native schedule. This is the only place a date may live.
 *
 * Twelve doors open every other day, Dec 1 to Dec 23, at 06:00 CET. CET is UTC+1 and
 * station time is fixed: 06:00 CET is one moment worldwide (05:00 UTC), never 06:00 in
 * the player's own time zone, and daylight saving time does not apply.
 *
 * Nothing about a door's content lives here. Project names stay out of this public
 * repository until their door is published.
 *
 * Every function takes `now` instead of reading the clock, so the schedule can be tested
 * at any moment and pages can decide which moment they render for.
 */

export const DOOR_COUNT = 12;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Door 1: Dec 1 2026, 06:00 CET. */
const FIRST_DOOR_OPENS_AT = Date.UTC(2026, 11, 1, 5);

/** Doors open every other day. */
const DOOR_INTERVAL = 2 * DAY;

/**
 * The "last incident" the prompt line counts from: Christmas Eve at 06:00 CET. Before the
 * season it is last year's; from Christmas Eve 2026 on, it is this year's finale.
 */
const CHRISTMAS_EVE_BEFORE_SEASON = Date.UTC(2025, 11, 24, 5);
const CHRISTMAS_EVE_FINALE = Date.UTC(2026, 11, 24, 5);

function assertDoorNumber(door: number): void {
  if (!Number.isInteger(door) || door < 1 || door > DOOR_COUNT) {
    throw new RangeError(`There is no door ${door}. Doors are numbered 1 to ${DOOR_COUNT}.`);
  }
}

/** When a door opens. */
export function doorOpensAt(door: number): Date {
  assertDoorNumber(door);
  return new Date(FIRST_DOOR_OPENS_AT + (door - 1) * DOOR_INTERVAL);
}

/**
 * Whether a door is open at `now`. This decides whether a door's content may be shown:
 * anything about a door that is not open must not be rendered or served.
 */
export function isDoorOpen(door: number, now: Date): boolean {
  return now.getTime() >= doorOpensAt(door).getTime();
}

/** The next door to open after `now` and when, or null once every door is open. */
export function nextDoor(now: Date): { door: number; opensAt: Date } | null {
  for (let door = 1; door <= DOOR_COUNT; door++) {
    const opensAt = doorOpensAt(door);
    if (opensAt.getTime() > now.getTime()) return { door, opensAt };
  }
  return null;
}

/**
 * Where the season stands at `now`: before door 1 opens, during December, or from the
 * finale on Christmas Eve.
 */
export function seasonPhase(now: Date): 'before' | 'during' | 'after' {
  if (now.getTime() < FIRST_DOOR_OPENS_AT) return 'before';
  if (now.getTime() < CHRISTMAS_EVE_FINALE) return 'during';
  return 'after';
}

// CET without daylight saving time. (IANA's Etc/ zones have inverted signs: GMT-1 is UTC+1.)
export const STATION_TIME_ZONE = 'Etc/GMT-1';

/** The day in station time, short and lowercase: "dec 1". */
export function formatStationDay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: STATION_TIME_ZONE, month: 'short', day: 'numeric' })
    .format(date)
    .toLowerCase();
}

/** The day in station time, written out for screen readers: "December 1". */
export function formatStationDayLong(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: STATION_TIME_ZONE, month: 'long', day: 'numeric' }).format(date);
}

/** The time of day in station time: "06:00 CET". */
export function formatStationClock(date: Date): string {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: STATION_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
  return `${time.format(date)} CET`;
}

/** A moment in station time, as the site writes it: "dec 1 · 06:00 CET". */
export function formatStationTime(date: Date): string {
  return `${formatStationDay(date)} · ${formatStationClock(date)}`;
}

/** The same moment written out for screen readers: "December 1 at 06:00 CET". */
export function formatStationTimeLong(date: Date): string {
  return `${formatStationDayLong(date)} at ${formatStationClock(date)}`;
}

/** Whole station days (06:00 CET to 06:00 CET) from `since` to `now`. */
function stationDaysBetween(since: number, now: Date): number {
  return Math.floor((now.getTime() - since) / DAY);
}

/**
 * Days since the last incident, for POLARIS-7's prompt line. A station day starts at
 * 06:00 CET, like the doors.
 *
 * - Before Dec 1: days since Christmas Eve 2025.
 * - Dec 1 to Dec 23: 00 on the day a door opens, 01 on the day in between.
 * - From Christmas Eve 2026: it resets and counts up from the finale.
 */
export function incidentDays(now: Date): number {
  if (now.getTime() >= CHRISTMAS_EVE_FINALE) {
    return stationDaysBetween(CHRISTMAS_EVE_FINALE, now);
  }
  if (now.getTime() >= FIRST_DOOR_OPENS_AT) {
    const lastOpened = Math.max(
      ...Array.from({ length: DOOR_COUNT }, (_, i) => doorOpensAt(i + 1).getTime()).filter(
        (opensAt) => opensAt <= now.getTime(),
      ),
    );
    return stationDaysBetween(lastOpened, now);
  }
  return Math.max(0, stationDaysBetween(CHRISTMAS_EVE_BEFORE_SEASON, now));
}
