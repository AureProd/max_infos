<script setup lang="ts">
const { data: site } = await useSite()

/**
 * La palette est injectée EN RENDU SERVEUR.
 *
 * Le style part avec le HTML : la page ne s'affiche jamais avec le thème
 * par défaut avant de basculer sur celui de Max. Un chargement côté
 * navigateur aurait produit ce clignotement à chaque visite.
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
