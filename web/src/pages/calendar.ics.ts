// The door schedule as a calendar file to import, built into a static file at build time.
import type { APIRoute } from 'astro';
import { buildCalendar } from '../lib/calendar';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('calendar.ics: `site` must be set in astro.config.mjs');
  return new Response(buildCalendar(site, new Date()), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
};
