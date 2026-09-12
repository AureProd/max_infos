<script setup>
import { ALL_TAGS } from '@/data/content'
import { useFilters } from '@/composables/useFilters'

const { state, toggleTag } = useFilters()
</script>

<template>
  <section class="filters">
    <label class="search">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
      <input
        id="q"
        v-model="state.q"
        type="search"
        placeholder="Chercher dans les articles et les notes"
        aria-label="Chercher"
      />
    </label>
    <div class="tags" role="group" aria-label="Filtrer par sujet">
      <button
        v-for="tag in ALL_TAGS"
        :key="tag"
        class="tag"
        :aria-pressed="state.tag === tag"
        @click="toggleTag(tag)"
      >
        {{ tag }}
      </button>
    </div>
  </section>
</template>
