/**
 * Serves schedule.yaml at the repository root as `virtual:schedule`: the parsed schedule
 * as plain timestamps, checked by parseSchedule.
 *
 * Parsing here, at build time, keeps the YAML parser out of the browser (the prompt
 * line's script needs the schedule too) and out of the on-demand Netlify function, which
 * gets the timestamps built in and needs no file at runtime. A broken schedule.yaml fails
 * the build. A virtual module also avoids Vite's fs.allow, which would refuse to serve a
 * file outside web/ to the browser under `astro dev`.
 *
 * Loaded by astro.config.mjs and vitest.config.ts, so the site and the tests read the same.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { parseSchedule } from '../src/lib/schedule.ts';

const SCHEDULE_FILE = fileURLToPath(new URL('../../schedule.yaml', import.meta.url));

const ID = 'virtual:schedule';
const RESOLVED_ID = `\0${ID}`;

export function schedule(): Plugin {
  return {
    name: 'aocn-schedule',
    resolveId(id) {
      if (id === ID) return RESOLVED_ID;
    },
    // Under `astro dev`, editing schedule.yaml reloads the page with the new dates. Vite's
    // addWatchFile only refreshes the server's copy, so the browser's is dropped here too.
    configureServer(server) {
      server.watcher.add(SCHEDULE_FILE);
      server.watcher.on('change', (file) => {
        if (file !== SCHEDULE_FILE) return;
        for (const environment of Object.values(server.environments)) {
          const module = environment.moduleGraph.getModuleById(RESOLVED_ID);
          if (module) environment.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: 'full-reload' });
      });
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      try {
        return `export default ${JSON.stringify(parseSchedule(readFileSync(SCHEDULE_FILE, 'utf8')))};`;
      } catch (error) {
        throw new Error(`${SCHEDULE_FILE}: ${(error as Error).message}`);
      }
    },
  };
}
