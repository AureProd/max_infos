<script setup lang="ts">
/**
 * Couverture d'article. Les visuels d'origine sont en portrait 4:5 sur fond
 * gris clair : on conserve leur cadrage natif par défaut et on éteint le
 * fond clair, qui éblouit sur un thème sombre.
 */
const props = withDefaults(
  defineProps<{
    src?: string | null
    seed?: number
    ratio?: string
    alt?: string
    tinted?: boolean
  }>(),
  { src: null, seed: 1, ratio: '4 / 5', alt: '', tinted: true },
)

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <div :class="['frame', tinted && 'tinted']" :style="{ aspectRatio: ratio }">
    <img
      v-if="src && !failed"
      class="cover"
      :src="src"
      :alt="alt"
      loading="lazy"
      @error="failed = true"
    />
    <PlateImage v-else :seed="seed" :w="600" :h="750" :alt="alt" />
  </div>
</template>
