<script setup lang="ts">
/**
 * Monter, descendre.
 *
 * L'ordre d'une liste EST son affichage : les contacts sortent sur « À
 * propos » dans l'ordre où ils sont enregistrés, et le seul moyen de les
 * réordonner était de retaper les champs les uns par-dessus les autres.
 *
 * Les flèches sont GRISÉES aux extrémités plutôt qu'absentes : une colonne
 * qui perd ses boutons sur la première et la dernière rangée décale tout
 * ce qui la suit.
 */
const props = defineProps<{
  index: number
  count: number
  /** Ce qu'on déplace, pour l'infobulle et les lecteurs d'écran. */
  what?: string
}>()

const emit = defineEmits<{ move: [to: number] }>()

const subject = computed(() => props.what?.trim() || 'cet élément')
</script>

<template>
  <div class="a-order">
    <Button
      v-tooltip.top="'Monter'"
      severity="secondary"
      text
      size="small"
      icon="pi pi-arrow-up"
      :aria-label="`Monter ${subject}`"
      :disabled="index === 0"
      @click="emit('move', index - 1)"
    />
    <Button
      v-tooltip.top="'Descendre'"
      severity="secondary"
      text
      size="small"
      icon="pi pi-arrow-down"
      :aria-label="`Descendre ${subject}`"
      :disabled="index >= count - 1"
      @click="emit('move', index + 1)"
    />
  </div>
</template>
