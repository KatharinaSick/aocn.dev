import { defineConfig } from 'vitest/config';
import { schedule } from './plugins/schedule.ts';

// Tests import doors.ts, which reads the schedule through the same plugin as the site.
export default defineConfig({
  plugins: [schedule()],
});
