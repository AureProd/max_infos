<script setup lang="ts">
const { data: site } = await useSite()

/**
 * The palette is injected DURING SERVER RENDERING.
 *
 * The style leaves with the HTML: the page never shows with the default
 * theme before switching to Max's. Loading it in the browser would have
 * produced that flicker on every visit.
 */
const variables = computed(() => {
  const v = site.value?.theme?.variables ?? {}
  const lignes = Object.entries(v).map(([cle, valeur]) => `  --${cle}: ${valeur};`)
  return lignes.length ? `:root {\n${lignes.join('\n')}\n}` : ''
})

useHead({
  style: () => (variables.value ? [{ innerHTML: variables.value, id: 'theme-du-site' }] : []),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
