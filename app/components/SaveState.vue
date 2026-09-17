<script setup lang="ts">
/**
 * Où en est l'enregistrement.
 *
 * Every screen saves on its own now — there is no button left to press, so
 * there has to be something to read. Three screens each had their own
 * wording for the same four states (« en cours », « enregistrement… »,
 * « échec », « modifications non enregistrées »), and each showed it in a
 * different corner.
 *
 * It is ALWAYS rendered, in the same place, and only changes: an indicator
 * that appears and disappears is one nobody notices.
 */
const props = withDefaults(
  defineProps<{
    /** `true` tant que des modifications ne sont pas parties. */
    modified?: boolean
    saving?: boolean
    failed?: boolean
    /** `true` une fois qu'un enregistrement a réussi. */
    saved?: boolean
  }>(),
  { modified: false, saving: false, failed: false, saved: false },
)

const state = computed(() => {
  if (props.failed)
    return { tone: 'is-failed', icon: 'pi-exclamation-circle', label: 'non enregistré' }
  if (props.saving)
    return { tone: 'is-saving', icon: 'pi-spin pi-spinner', label: 'enregistrement…' }
  if (props.modified)
    return { tone: 'is-pending', icon: 'pi-pencil', label: 'modifications en cours' }
  if (props.saved) return { tone: 'is-saved', icon: 'pi-check', label: 'enregistré' }
  return { tone: 'is-idle', icon: 'pi-cloud', label: 'à jour' }
})
</script>

<template>
  <span :class="['a-save', state.tone]" aria-live="polite">
    <i :class="['pi', state.icon]" aria-hidden="true" />
    {{ state.label }}
  </span>
</template>
