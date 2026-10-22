/**
 * The Advent of Cloud Native schedule: when doors open, and what that means for the
 * page. The dates themselves live in schedule.yaml at the repository root, which
 * explains station time; this file has none of its own.
 *
 * Every function takes `now` instead of reading the clock, so the schedule can be tested
 * at any moment and pages can decide which moment they render for.
 */
import schedule from 'virtual:schedule';
import type { Schedule } from './schedule';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface Doors {
  /** How many doors there are: the length of the list in schedule.yaml. */
  count: number;
  /** When a door opens. */
  doorOpensAt(door: number): Date;
  /**
   * Whether a door is open at `now`. This decides whether a door's content may be shown:
   * anything about a door that is not open must not be rendered or served.
   */
  isDoorOpen(door: number, now: Date): boolean;
  /** The next door to open after `now` and when, or null once every door is open. */
  nextDoor(now: Date): { door: number; opensAt: Date } | null;
  /**
   * Where the season stands at `now`: before door 1 opens, during December, or from the
   * finale on Christmas Eve.
   */
  seasonPhase(now: Date): 'before' | 'during' | 'after';
  /**
   * Days since the last incident, for POLARIS-7's prompt line. A station day starts at
   * 06:00 CET, like the doors.
   *
   * - Before door 1: days since last year's Christmas Eve.
   * - While doors open: 00 on the day a door opens, 01 on the day in between.
   * - From the finale on Christmas Eve: it resets and counts up from there.
   */
  incidentDays(now: Date): number;
}

/** The rules above for any schedule. The site uses the real one, exported below. */
export function doorsOf({ doors, christmasEve }: Schedule): Doors {
  const count = doors.length;
  const firstDoorOpensAt = doors[0];

  function assertDoorNumber(door: number): void {
    if (!Number.isInteger(door) || door < 1 || door > count) {
      throw new RangeError(`There is no door ${door}. Doors are numbered 1 to ${count}.`);
    }
  }

  function doorOpensAt(door: number): Date {
    assertDoorNumber(door);
    return new Date(doors[door - 1]);
  }

  /** Whole station days (06:00 CET to 06:00 CET) from `since` to `now`. */
  function stationDaysBetween(since: number, now: Date): number {
    return Math.floor((now.getTime() - since) / DAY);
  }

  return {
    count,
    doorOpensAt,
    isDoorOpen(door, now) {
      return now.getTime() >= doorOpensAt(door).getTime();
    },
    nextDoor(now) {
      const i = doors.findIndex((opensAt) => opensAt > now.getTime());
      return i === -1 ? null : { door: i + 1, opensAt: new Date(doors[i]) };
    },
    seasonPhase(now) {
      if (now.getTime() < firstDoorOpensAt) return 'before';
      if (now.getTime() < christmasEve.finale) return 'during';
      return 'after';
    },
    incidentDays(now) {
      if (now.getTime() >= christmasEve.finale) {
        return stationDaysBetween(christmasEve.finale, now);
      }
      if (now.getTime() >= firstDoorOpensAt) {
        const lastOpened = Math.max(...doors.filter((opensAt) => opensAt <= now.getTime()));
        return stationDaysBetween(lastOpened, now);
      }
      return Math.max(0, stationDaysBetween(christmasEve.beforeSeason, now));
    },
  };
}

const season = doorsOf(schedule);

export const DOOR_COUNT = season.count;
export const { doorOpensAt, isDoorOpen, nextDoor, seasonPhase, incidentDays } = season;

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
