/**
 * What a `:` command does. Kept free of the DOM so it can be tested; VimKeys.vue carries
 * out the result.
 */
import { seasonPhase } from './doors';

export type VimAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'keysOff'; message: string }
  | { kind: 'message'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

// :doors joins in December, when there are doors to go to.
const PAGES: Record<string, string> = {
  man: '/how-it-works',
};

// The secret. It is never listed anywhere, and POLARIS-7's answer changes with the season.
const QUIT = new Set(['q', 'q!', 'qa', 'qa!', 'quit', 'wq', 'x']);
const QUIT_ANSWERS = {
  before: 'E37: Quitting before December 1 is not supported.',
  during: 'E37: No leaving. The last flight was cancelled.',
  after: 'E37: Stay. They saved you a seat.',
};

/** Runs a command typed after `:` (without the colon). */
export function runCommand(input: string, now: Date): VimAction {
  const command = input.trim();
  if (command === '') return { kind: 'none' };
  if (QUIT.has(command)) return { kind: 'error', message: QUIT_ANSWERS[seasonPhase(now)] };
  // Like vim's :set noxyz. Only "off" does something: with the keys off, : no longer works,
  // so the footer button is the way back.
  if (command === 'set nokeys') return { kind: 'keysOff', message: 'vim keys are off. The footer button brings them back.' };
  if (command === 'set keys') return { kind: 'message', message: 'vim keys are already on.' };
  const page = PAGES[command];
  if (page) return { kind: 'navigate', to: page };
  return { kind: 'error', message: `E492: Not an editor command: ${command}` };
}
