/**
 * Picks where h j k l move the keyboard focus: the nearest element in that direction.
 * Kept free of the DOM so it can be tested; VimKeys.vue measures the page and moves focus.
 */

export type Direction = 'left' | 'down' | 'up' | 'right';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// How much being off to the side counts against a candidate, compared to distance in the
// direction of travel. Above 1, so moving down prefers what is straight below over what is
// closer but far to the side.
const SIDEWAYS_WEIGHT = 2;

/**
 * The index of the candidate to move to from `from` in `direction`, or -1 if there is
 * nothing that way. A candidate counts when its centre lies beyond the current element's
 * centre in that direction. h and l stay within the row: they only consider elements that
 * overlap the current one vertically. j and k search the whole page.
 */
export function pickNext(from: Box, candidates: Box[], direction: Direction): number {
  const centre = (box: Box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  const origin = centre(from);
  let best = -1;
  let bestScore = Infinity;

  candidates.forEach((candidate, index) => {
    const { x, y } = centre(candidate);
    const dx = x - origin.x;
    const dy = y - origin.y;
    const [ahead, sideways] =
      direction === 'down' ? [dy, dx] : direction === 'up' ? [-dy, dx] : direction === 'right' ? [dx, dy] : [-dx, dy];
    if (ahead <= 1) return;
    const horizontal = direction === 'left' || direction === 'right';
    const sameRow = candidate.top < from.top + from.height && candidate.top + candidate.height > from.top;
    if (horizontal && !sameRow) return;
    const score = ahead + SIDEWAYS_WEIGHT * Math.abs(sideways);
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });

  return best;
}
