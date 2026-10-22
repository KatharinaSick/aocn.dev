/**
 * Reads schedule.yaml at the repository root, the one place a date lives. The API reads
 * the same file (api/internal/schedule) and must accept and reject exactly what this
 * does; the shared files in testdata/ check that.
 *
 * Runs at build time only, in the Vite plugin (web/plugins/schedule.ts): the browser
 * gets the parsed timestamps, never the YAML or this parser.
 *
 * Dates stay strings until they are checked here. YAML 1.2, which `yaml` follows, has no
 * timestamp type, and yaml.v3 decodes them into Go strings, so neither side guesses: a
 * date needs a date, a time and an offset, or it is rejected.
 */
import { parse } from 'yaml';

export interface Schedule {
  /** When each door opens, door 1 first, in milliseconds since the epoch. */
  doors: number[];
  /** The two moments POLARIS-7's incident counter counts from, in milliseconds. */
  christmasEve: { beforeSeason: number; finale: number };
}

// The same pattern as in the Go package: seconds, no fractions, and Z or a ±HH:MM offset.
const DATE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|([+-])(\d{2}):(\d{2}))$/;

const MINUTE = 60 * 1000;

/** Parses schedule.yaml. Throws an Error naming the door or key that is wrong. */
export function parseSchedule(text: string): Schedule {
  let file: unknown;
  try {
    file = parse(text);
  } catch (error) {
    throw new Error(`not valid YAML: ${(error as Error).message}`);
  }

  const top = asMapping(file, 'schedule', ['doors', 'christmasEve']);

  if (!Array.isArray(top.doors) || top.doors.length === 0) {
    throw new Error('doors: must be a list with at least one date');
  }
  const doors = top.doors.map((value, i) => parseDate(value, `door ${i + 1}`));
  for (let i = 1; i < doors.length; i++) {
    if (doors[i] <= doors[i - 1]) {
      throw new Error(`door ${i + 1}: opens at ${top.doors[i]}, not after door ${i}`);
    }
  }

  const christmasEve = asMapping(top.christmasEve ?? {}, 'christmasEve', ['beforeSeason', 'finale']);
  return {
    doors,
    christmasEve: {
      beforeSeason: parseDate(christmasEve.beforeSeason, 'christmasEve.beforeSeason'),
      finale: parseDate(christmasEve.finale, 'christmasEve.finale'),
    },
  };
}

/** A mapping with only the given keys, like yaml.v3 with KnownFields on the Go side. */
function asMapping(value: unknown, label: string, keys: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label}: must be a mapping with ${keys.join(' and ')}`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`${label}: unknown key "${key}"`);
  }
  return value as Record<string, unknown>;
}

function parseDate(value: unknown, label: string): number {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${label}: missing date`);
  }
  // yaml.v3 hands a number or a boolean to Go as its text, so the message matches.
  const text = typeof value === 'number' || typeof value === 'boolean' ? String(value) : value;
  if (typeof text !== 'string') throw new Error(`${label}: not a date`);

  const match = DATE.exec(text);
  if (!match) {
    throw new Error(`${label}: "${text}" needs a date, a time and an offset, like 2026-12-01T06:00:00+01:00`);
  }

  const [, year, month, day, hour, minute, second, , , offsetHours, offsetMinutes] = match.map(Number);
  const local = Date.UTC(year, month - 1, day, hour, minute, second);
  // Date.UTC rolls Feb 30 over into March instead of refusing it, so check it came back unchanged.
  const back = new Date(local);
  const valid =
    back.getUTCFullYear() === year &&
    back.getUTCMonth() === month - 1 &&
    back.getUTCDate() === day &&
    back.getUTCHours() === hour &&
    back.getUTCMinutes() === minute &&
    back.getUTCSeconds() === second &&
    (match[7] === 'Z' || (offsetHours <= 23 && offsetMinutes <= 59));
  if (!valid) throw new Error(`${label}: "${text}" is not a valid date`);

  if (match[7] === 'Z') return local;
  const offset = (offsetHours * 60 + offsetMinutes) * MINUTE;
  return match[8] === '+' ? local - offset : local + offset;
}
