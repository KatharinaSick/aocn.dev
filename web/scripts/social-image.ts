// Draws the social preview image: starts `astro dev`, screenshots /social-image
// (src/social/SocialImagePage.astro) and writes public/social.png. Run it with
// `npm run social-image` after changing that page; the PNG is committed.
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { dev } from 'astro';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = fileURLToPath(new URL('../public/social.png', import.meta.url));

const server = await dev({ root, logLevel: 'warn', server: { port: 4798 }, devToolbar: { enabled: false } });
const browser = await chromium.launch();
try {
  // 600 × 315 at 2×: a 1200 × 630 image, the size link previews expect.
  const page = await browser.newPage({ viewport: { width: 600, height: 315 }, deviceScaleFactor: 2 });
  await page.goto(`http://localhost:${server.address.port}/social-image`);
  await page.evaluate(() => document.fonts.ready);
  // The aurora held still at its starting position, so every run draws the same image.
  await page.addStyleTag({ content: '.skyAurora, .skyRays { animation: none !important; }' });
  await page.screenshot({ path: output });
  console.log(`Wrote ${output}`);
} finally {
  await browser.close();
  await server.stop();
}
