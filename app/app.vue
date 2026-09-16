<script setup lang="ts">
/**
 * The site's look is FIXED IN THE CODE.
 *
 * A theme editable from the back-office used to be injected here, as a
 * <style> overriding :root during server rendering. It is gone: Max chooses
 * the articles, the publications and the about information — never the
 * visual or the layout of the sections (JB's decision, see CLAUDE.md).
 */
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
