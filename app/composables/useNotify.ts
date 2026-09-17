import { reason } from '#shared/utils/errors'

/**
 * Saying that it worked, or why it did not — once, for every screen.
 *
 * Before this, each screen carried its own little state machine
 * (`'repos' | 'enregistré' | 'échec'`) and printed the result inline, in a
 * corner Max was not looking at. Six copies, six wordings, and an error that
 * scrolled off screen with the form.
 *
 * A toast is deliberately NOT the whole answer: a save that only ever
 * succeeds should stay quiet, and a field-level refusal still belongs next
 * to its field. This is for the outcome of an ACTION — synchronised,
 * deleted, invited, restored.
 */
export function useNotify() {
  const toast = useToast()

  /** It worked. Green, top right, gone on its own. */
  function ok(summary: string, detail?: string): void {
    toast.add({ severity: 'success', summary, detail, life: 3000 })
  }

  /**
   * It did not work. Red, and it STAYS until dismissed.
   *
   * A failure that disappears after three seconds is a failure Max misses
   * while he is typing — which is how a refused save came to look like a
   * form that would not stick.
   */
  function fail(error: unknown, summary = 'Échec'): void {
    toast.add({ severity: 'error', summary, detail: reason(error), life: undefined })
  }

  /** Something to know, that is neither a success nor a failure. */
  function info(summary: string, detail?: string): void {
    toast.add({ severity: 'info', summary, detail, life: 4000 })
  }

  return { ok, fail, info }
}
