// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import netlify from '@astrojs/netlify';
import vue from '@astrojs/vue';

// The Netlify adapter is loaded for `astro build` only. `astro dev` renders on-demand
// pages itself, and loading the adapter in dev pulls in Netlify's platform emulation
// for features this site does not use. See AGENTS.md → Rendering.
const isBuild = process.argv.includes('build');

// https://astro.build/config
export default defineConfig({
  // Canonical URLs and social image URLs are built from this.
  site: 'https://aocn.dev',
  adapter: isBuild ? netlify() : undefined,
  // Vue 3 islands for anything interactive; everything else stays plain Astro.
  integrations: [vue()],
  // Self-hosted: Astro downloads the font files at build time and serves them from
  // aocn.dev, so no visitor request goes to a third-party font CDN.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'Menlo', 'Consolas', 'monospace'],
    },
  ],
});