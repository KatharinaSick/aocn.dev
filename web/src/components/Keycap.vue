<script setup lang="ts">
// A key drawn like a keyboard key. Used in the ? help overlay; pages themselves never
// show a legend, they only say "press ? for vim keys".
</script>

<template>
  <kbd class="keycap"><slot /></kbd>
</template>

<style scoped>
.keycap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--space-6);
  height: var(--space-6);
  padding: 0 var(--space-1);
  border: 1px solid var(--color-line-strong);
  border-bottom-width: 3px;
  background: var(--color-panel);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-small);
  line-height: 1;
}
</style>
