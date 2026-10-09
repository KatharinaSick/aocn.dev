<script setup lang="ts">
// The vim layer: keys that work anywhere on the page without clicking first, the vim
// statusline that appears once someone uses them, and the ? help overlay.
//
// - h j k l move the keyboard focus to the nearest link or button in that direction
//   (lib/spatial.ts). They skip text fields: in a field every letter types, so h j k l
//   would get stuck there. Fields are reached with s, Tab or a click, and left with Esc.
// - Keys never fire while someone types in a field, or with Ctrl, Cmd or Alt held, so
//   browser shortcuts stay untouched. Esc in a field leaves it, like leaving insert mode.
// - Single-key shortcuts can be switched off in the help overlay (WCAG 2.1.4). Off means
//   off, ? included; the footer button still opens the overlay to switch them back on.
// - Page-specific keys only exist where their target does: s needs [data-vim-subscribe],
//   c needs [data-vim-calendar]. q (back home) is listed everywhere and simply does
//   nothing on the home page.
// - Screen readers hear messages through a live region; the statusline is visual only.
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { type Direction, pickNext } from '../lib/spatial';
import { GLOBAL_KEYS } from '../lib/keys';
import { runCommand } from '../lib/vim';
import Keycap from './Keycap.vue';

const STORAGE_KEY = 'aocn:vim-keys';

const enabled = ref(true);
const active = ref(false);
const mode = ref<'normal' | 'command'>('normal');
const command = ref('');
const message = ref<{ text: string; error: boolean } | null>(null);
const help = ref<HTMLDialogElement | null>(null);
const pageKeys = ref({ subscribe: false, calendar: false });

// Shown once a key was used, while the keys are on, and for the last message after
// :set nokeys switched them off.
const statuslineShown = computed(() => active.value && (enabled.value || message.value !== null));

// Set in the browser; the page is prerendered without one.
const file = ref('');

function findSubscribe() {
  return document.querySelector<HTMLElement>('[data-vim-subscribe]');
}

function isHome() {
  return window.location.pathname === '/';
}

function findCalendar() {
  return document.querySelector<HTMLElement>('[data-vim-calendar]');
}

const DIRECTIONS: Record<string, Direction> = { h: 'left', j: 'down', k: 'up', l: 'right' };

const FOCUSABLE = 'a[href], button:not([disabled])';

/** Everything h j k l can land on: visible, and not tucked away above the page (the skip link). */
function focusables() {
  return [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom + window.scrollY > 0;
  });
}

// Where Esc left a field, so h j k l carry on from there instead of starting over.
let leftField: HTMLElement | null = null;

function move(direction: Direction) {
  const targets = focusables();
  const focused = document.activeElement as HTMLElement | null;
  const current = focused && targets.includes(focused) ? focused : leftField;
  leftField = null;
  if (!current) {
    // Nothing focused yet: start at the top for j and l, at the bottom for k and h.
    const start = direction === 'down' || direction === 'right' ? targets[0] : targets.at(-1);
    start?.focus();
    return;
  }
  const others = targets.filter((element) => element !== current);
  const index = pickNext(current.getBoundingClientRect(), others.map((element) => element.getBoundingClientRect()), direction);
  if (index >= 0) others[index].focus();
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function say(text: string, error = false) {
  message.value = { text, error };
}

function setEnabled(value: boolean) {
  enabled.value = value;
  document.documentElement.dataset.vimKeys = value ? 'on' : 'off';
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the choice lasts until the page is left.
  }
  if (value) message.value = null;
  else {
    active.value = false;
    mode.value = 'normal';
  }
}

function openHelp() {
  pageKeys.value = { subscribe: findSubscribe() !== null, calendar: findCalendar() !== null };
  help.value?.showModal();
}

function closeHelp() {
  help.value?.close();
}

function execute() {
  const action = runCommand(command.value, new Date());
  mode.value = 'normal';
  command.value = '';
  if (action.kind === 'navigate') window.location.href = action.to;
  if (action.kind === 'message') say(action.message);
  if (action.kind === 'error') say(action.message, true);
  if (action.kind === 'keysOff') {
    setEnabled(false);
    // The statusline stays for this one last message.
    say(action.message);
    active.value = true;
  }
}

function onCommandKey(event: KeyboardEvent) {
  if (event.key === 'Enter') execute();
  else if (event.key === 'Escape') {
    mode.value = 'normal';
    command.value = '';
  } else if (event.key === 'Backspace') {
    if (command.value === '') mode.value = 'normal';
    else command.value = command.value.slice(0, -1);
  } else if (event.key.length === 1) command.value += event.key;
  else return;
  event.preventDefault();
}

function onNormalKey(event: KeyboardEvent) {
  switch (event.key) {
    case '?':
      openHelp();
      break;
    case ':':
      mode.value = 'command';
      command.value = '';
      message.value = null;
      break;
    case 's': {
      const subscribe = findSubscribe();
      if (!subscribe) return;
      subscribe.focus();
      break;
    }
    case 'c': {
      const calendar = findCalendar();
      if (!calendar) return;
      calendar.focus();
      break;
    }
    case 'h':
    case 'j':
    case 'k':
    case 'l':
      move(DIRECTIONS[event.key]);
      break;
    case 'q':
      if (isHome()) return;
      window.location.href = '/';
      break;
    case 'Escape':
      if (!active.value) return;
      message.value = null;
      break;
    default:
      return;
  }
  active.value = true;
  event.preventDefault();
}

function onKeydown(event: KeyboardEvent) {
  if (!enabled.value || event.defaultPrevented) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (help.value?.open) return;
  if (isTyping(event.target)) {
    // Esc leaves the field, so h j k l work again.
    if (event.key === 'Escape' && mode.value === 'normal') {
      leftField = event.target as HTMLElement;
      leftField.blur();
      active.value = true;
      event.preventDefault();
    }
    return;
  }
  if (mode.value === 'command') onCommandKey(event);
  else onNormalKey(event);
}

function onHelpButton(event: Event) {
  if ((event.target as HTMLElement).closest('[data-vim-help]')) openHelp();
}

onMounted(() => {
  file.value = `"~${window.location.pathname.replace(/\/$/, '')}"`;

  // While the statusline shows, the page gets room for it at the bottom (see BaseLayout).
  watchEffect(() => {
    document.documentElement.classList.toggle('vimStatuslineShown', statuslineShown.value);
  });

  try {
    if (localStorage.getItem(STORAGE_KEY) === 'off') setEnabled(false);
  } catch {
    // Storage unavailable: keys stay on.
  }
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('click', onHelpButton);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('click', onHelpButton);
});
</script>

<template>
  <div v-if="statuslineShown" class="vimStatusline" aria-hidden="true">
    <span class="vimMode" :class="mode === 'command' ? 'vimModeCommand' : 'vimModeNormal'">
      {{ mode === 'command' ? 'COMMAND' : 'NORMAL' }}
    </span>
    <span v-if="mode === 'command'" class="vimInfo">:{{ command }}<span class="vimCursor">█</span></span>
    <span v-else-if="message" class="vimInfo" :class="{ vimInfoError: message.error }">{{ message.text }}</span>
    <span v-else class="vimInfo">{{ file }}</span>
  </div>

  <p class="srOnly" role="status">{{ message?.text }}</p>

  <dialog ref="help" class="vimHelp" aria-labelledby="vim-help-title">
    <h2 id="vim-help-title" class="vimHelpTitle">## vim keys</h2>
    <p class="vimHelpIntro">Everything works with a mouse. If you prefer your hands on the keyboard:</p>
    <!-- "everywhere" is the same on every page; "on this page" only appears where a page has keys. -->
    <h3 class="vimHelpGroup">everywhere</h3>
    <dl class="vimHelpKeys">
      <template v-for="entry in GLOBAL_KEYS" :key="entry.does">
        <dt class="vimHelpKeyRow"><Keycap v-for="key in entry.keys" :key="key">{{ key }}</Keycap></dt>
        <dd>{{ entry.does }}</dd>
      </template>
    </dl>
    <template v-if="pageKeys.subscribe || pageKeys.calendar">
      <h3 class="vimHelpGroup">on this page</h3>
      <dl class="vimHelpKeys">
        <template v-if="pageKeys.subscribe">
          <dt><Keycap>s</Keycap></dt>
          <dd>subscribe</dd>
        </template>
        <template v-if="pageKeys.calendar">
          <dt><Keycap>c</Keycap></dt>
          <dd>add to calendar</dd>
        </template>
      </dl>
    </template>
    <div class="vimHelpActions">
      <button class="vimHelpButton" type="button" :aria-pressed="enabled" @click="setEnabled(!enabled)">
        vim keys: {{ enabled ? 'on' : 'off' }}
      </button>
      <button class="vimHelpButton" type="button" @click="closeHelp">close</button>
    </div>
  </dialog>
</template>

<style scoped>
.vimStatusline {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  height: var(--size-statusline);
  border-top: 1px solid var(--color-line);
  background: var(--color-panel);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}

.vimMode {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 var(--space-3);
  color: var(--color-bg);
  font-weight: var(--font-weight-bold);
}

.vimModeNormal {
  background: var(--color-aurora);
}

.vimModeCommand {
  background: var(--color-signal);
}

.vimInfo {
  padding: 0 var(--space-4);
  color: var(--color-text);
}

.vimInfoError {
  color: var(--color-error);
}

.vimCursor {
  color: var(--color-aurora);
}

.vimHelp {
  width: min(100% - 2 * var(--space-4), 60ch);
  padding: var(--space-6);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-none);
  background: var(--color-panel);
  color: var(--color-text);
  box-shadow: var(--shadow-overlay);
}

.vimHelp::backdrop {
  background: color-mix(in srgb, var(--color-sky-top) 70%, transparent);
}

.vimHelpTitle {
  color: var(--color-aurora);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-regular);
}

.vimHelpIntro {
  margin-top: var(--space-3);
  color: var(--color-text-soft);
}

.vimHelpGroup {
  margin-top: var(--space-6);
  color: var(--color-muted);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-regular);
}

.vimHelpKeys {
  display: grid;
  /* A fixed key column, so both groups line up. */
  grid-template-columns: 12ch 1fr;
  gap: var(--space-3) var(--space-6);
  align-items: center;
  margin: var(--space-3) 0 0;
}

.vimHelpKeyRow {
  display: flex;
  gap: var(--space-1);
}

.vimHelpActions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.vimHelpButton {
  height: var(--size-control);
  padding: 0 var(--space-4);
  border: 1px solid var(--color-dim);
  border-radius: var(--radius-none);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

.vimHelpButton:hover {
  border-color: var(--color-text-soft);
}
</style>
