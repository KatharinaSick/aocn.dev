// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// The Netlify adapter is loaded for `astro build` only. `astro dev` renders on-demand
// pages itself, and loading the adapter in dev pulls in Netlify's platform emulation
// for features this site does not use. See AGENTS.md → Rendering.
const isBuild = process.argv.includes('build');

// https://astro.build/config
export default defineConfig({
  adapter: isBuild ? netlify() : undefined,
});
