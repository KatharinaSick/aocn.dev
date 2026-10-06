import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Every prerendered page in dist/, so a new page is covered without touching this file.
const distDir = join(import.meta.dirname, '..', 'dist');

function findPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findPages(path);
    if (!entry.name.endsWith('.html')) return [];
    const route = relative(distDir, path).split(sep).join('/');
    if (route === 'index.html') return ['/'];
    if (route.endsWith('/index.html')) return [`/${route.slice(0, -'index.html'.length)}`];
    return [`/${route.slice(0, -'.html'.length)}`];
  });
}

const pages = findPages(distDir);

test('dist/ contains the pages to test', () => {
  expect(pages, 'run `npm run build` first').toContain('/');
});

// One entry per failing element, so the CI log says what broke and where.
function describeViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']): string[] {
  return violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id} (${violation.impact}): ${violation.help} — ${node.target.join(' ')}`),
  );
}

// Tabs through the page and returns what received focus, until focus wraps or leaves the
// document. Capped so a focus trap fails the test instead of hanging it.
async function tabThrough(page: Page) {
  const stops: { name: string; hasRing: boolean }[] = [];
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return null;
      // Marks the element itself: two stops can share a label, so names cannot detect the wrap.
      if (element.dataset.a11yVisited) return null;
      element.dataset.a11yVisited = 'true';
      const style = getComputedStyle(element);
      const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      const name = `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
      return { name, hasRing: hasOutline || style.boxShadow !== 'none' };
    });
    if (!stop) return stops;
    stops.push(stop);
  }
  throw new Error('Focus never wrapped after 100 tabs — is there a focus trap?');
}

for (const path of pages) {
  test.describe(path, () => {
    test('has no axe violations', async ({ page }) => {
      await page.goto(path);
      // axe cannot measure text over the sky (stars, aurora, the landing fade), so there it
      // reports contrast as "needs review" instead of failing. All three are decorative and
      // aria-hidden; without them, text is checked against the page background. Contrast
      // against the aurora glow itself is not covered here.
      await page.addStyleTag({ content: '.sky, .landingFade { display: none !important; }' });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        // The design system's PromptLine demo duplicates the layout's real one, so it
        // repeats the "POLARIS-7" landmark. The real one is still checked on every page.
        .exclude('.designSystemGroup > .promptLine')
        .analyze();
      expect(describeViolations(results.violations), 'axe violations').toEqual([]);
    });

    test('skip link comes first and every focus stop is visible', async ({ page }) => {
      await page.goto(path);
      const stops = await tabThrough(page);
      expect(stops[0]?.name, 'first tab stop').toMatch(/skip to content/i);
      const withoutRing = stops.filter((stop) => !stop.hasRing).map((stop) => stop.name);
      expect(withoutRing, 'focusable elements without a visible focus ring').toEqual([]);
    });
  });
}
