<script setup>
import { ref, watch } from 'vue'
import PlateImage from './PlateImage.vue'

/**
 * Couverture d'article. Les visuels d'origine sont en portrait 4:5 sur
 * fond gris clair : on conserve leur cadrage natif par défaut et on
 * éteint le fond clair, qui éblouit sur un thème sombre.
 */
const props = defineProps({
  src: { type: String, default: null },
  seed: { type: Number, default: 1 },
  ratio: { type: String, default: '4 / 5' },
  alt: { type: String, default: '' },
  tinted: { type: Boolean, default: true }
})

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  }
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
