import { describe, expect, it } from 'vitest';
import { runCommand } from './vim';

const beforeLaunch = new Date('2026-10-01T12:00:00Z');

describe('runCommand', () => {
  it('goes to the pages it knows', () => {
    expect(runCommand('man', beforeLaunch)).toEqual({ kind: 'navigate', to: '/how-it-works' });
    expect(runCommand('  man ', beforeLaunch)).toEqual({ kind: 'navigate', to: '/how-it-works' });
  });

  it('answers anything else like vim does', () => {
    expect(runCommand('stroy', beforeLaunch)).toEqual({ kind: 'error', message: 'E492: Not an editor command: stroy' });
  });

  it('has no story or doors pages before launch', () => {
    expect(runCommand('story', beforeLaunch)).toEqual({ kind: 'error', message: 'E492: Not an editor command: story' });
    expect(runCommand('doors', beforeLaunch)).toEqual({ kind: 'error', message: 'E492: Not an editor command: doors' });
  });

  it('does nothing for an empty command', () => {
    expect(runCommand('', beforeLaunch)).toEqual({ kind: 'none' });
    expect(runCommand('   ', beforeLaunch)).toEqual({ kind: 'none' });
  });

  it('never lets anyone quit, and says so differently over the season', () => {
    const answer = (iso: string) => runCommand('q', new Date(iso));
    expect(answer('2026-10-01T12:00:00Z')).toEqual({ kind: 'error', message: 'E37: Quitting before December 1 is not supported.' });
    expect(answer('2026-12-01T05:00:00Z')).toEqual({ kind: 'error', message: 'E37: No leaving. The last flight was cancelled.' });
    expect(answer('2026-12-24T05:00:00Z')).toEqual({ kind: 'error', message: 'E37: Stay. They saved you a seat.' });
  });

  it('treats every way of quitting the same', () => {
    for (const quit of ['q', 'q!', 'qa', 'qa!', 'quit', 'wq', 'x']) {
      expect(runCommand(quit, beforeLaunch)).toEqual({ kind: 'error', message: 'E37: Quitting before December 1 is not supported.' });
    }
  });

  it('switches the vim keys off with :set nokeys', () => {
    expect(runCommand('set nokeys', beforeLaunch)).toEqual({ kind: 'keysOff', message: 'vim keys are off. The footer button brings them back.' });
    expect(runCommand('set keys', beforeLaunch)).toEqual({ kind: 'message', message: 'vim keys are already on.' });
  });
});
