<script setup>
import { ref } from 'vue'
import SlideView from './SlideView.vue'
import ChevronButton from './ChevronButton.vue'

/** Carrousel de publication : flèches, points, flèches du clavier. */
const props = defineProps({
  slides: { type: Array, required: true },
  handle: { type: String, default: '@unmaxdinfo_' }
})

const i = ref(0)
const show = (k) => {
  i.value = Math.max(0, Math.min(props.slides.length - 1, k))
}

function onKey(e) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    show(i.value - 1)
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    show(i.value + 1)
  }
}
</script>

<template>
  <div
    class="gal"
    tabindex="0"
    :aria-label="`Carrousel de ${slides.length} volets`"
    @keydown="onKey"
  >
    <div class="gal-win">
      <div class="gal-track" :style="{ transform: `translateX(-${i * 100}%)` }">
        <div v-for="(spec, k) in slides" :key="k">
          <SlideView :spec="spec" :handle="handle" />
        </div>
      </div>

      <template v-if="slides.length > 1">
        <span class="gal-count">{{ i + 1 }} / {{ slides.length }}</span>
        <ChevronButton :dir="-1" label="Volet précédent" :disabled="i === 0" @click="show(i - 1)" />
        <ChevronButton
          :dir="1"
          label="Volet suivant"
          :disabled="i === slides.length - 1"
          @click="show(i + 1)"
        />
      </template>
    </div>

    <div v-if="slides.length > 1" class="dots">
      <button
        v-for="(spec, k) in slides"
        :key="k"
        class="dot"
        :aria-current="k === i"
        :aria-label="`Volet ${k + 1}`"
        @click="show(k)"
      />
    </div>
  </div>
</template>
