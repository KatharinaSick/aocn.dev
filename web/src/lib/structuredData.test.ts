import { describe, expect, it } from 'vitest';
import { DOOR_COUNT, doorOpensAt } from './doors';
import { landingStructuredData, toJsonLd } from './structuredData';

describe('landingStructuredData', () => {
  const event = landingStructuredData('A description.', 'https://aocn.dev/social.png')['@graph'][1];

  it('runs the event from the first door to the last', () => {
    expect(event.startDate).toBe(doorOpensAt(1).toISOString());
    expect(event.endDate).toBe(doorOpensAt(DOOR_COUNT).toISOString());
  });

  it('starts on Dec 1 at 06:00 CET', () => {
    expect(event.startDate).toBe('2026-12-01T05:00:00.000Z');
  });
});

describe('toJsonLd', () => {
  it('cannot close the script element it is embedded in', () => {
    const json = toJsonLd({ description: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json).description).toBe('</script><script>alert(1)</script>');
  });
});
