/**
 * The vim keys that work on every page, in one place: the ? help overlay and the KEYS
 * section of the man page both list them from here. Page-specific keys (s, c) live with
 * their pages. :q and :set nokeys are secrets and never listed.
 */
export interface KeyHelp {
  keys: string[];
  does: string;
}

export const GLOBAL_KEYS: KeyHelp[] = [
  { keys: ['?'], does: 'this help' },
  { keys: ['h', 'j', 'k', 'l'], does: 'move left · down · up · right' },
  { keys: [':man'], does: 'how it works' },
  { keys: ['q'], does: 'back home' },
  { keys: ['esc'], does: 'close · cancel · leave a field' },
];
