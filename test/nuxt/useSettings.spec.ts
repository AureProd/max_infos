import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSetting } from '~/composables/useSettings'

/**
 * Reading and writing a setting from the back-office. This composable
 * protects nothing — the server refuses a technical key to an editor — so
 * what matters here is that it REPORTS the save honestly.
 */

let stored: Record<string, unknown> = {}
let readFails = false
let writeFails = false
let lastWrite: unknown = null

registerEndpoint('/api/admin/settings', () => {
  if (readFails) throw new Error('indisponible')
  return stored
})
registerEndpoint('/api/admin/settings/templates', {
  method: 'PUT',
  handler: async (event) => {
    if (writeFails) throw new Error('refusé')
    lastWrite = await readBody(event)
    return lastWrite
  },
})

beforeEach(() => {
  stored = { templates: { linkedin: 'un gabarit', reel: '' } }
  readFails = false
  writeFails = false
  lastWrite = null
})

describe('load', () => {
  it('picks its own key out of the whole answer', async () => {
    const { value, state, load } = useSetting('templates')
    await load()

    expect(value.value).toEqual({ linkedin: 'un gabarit', reel: '' })
    expect(state.value).toBe('repos')
  })

  it('settles on null when the key has never been written', async () => {
    stored = {}
    const { value, state, load } = useSetting('templates')
    await load()

    expect(value.value).toBeNull()
    expect(state.value).toBe('repos')
  })

  it('says it failed rather than showing an empty form as if it were saved', async () => {
    readFails = true
    const { state, load } = useSetting('templates')
    await load()
    expect(state.value).toBe('échec')
  })
})

describe('save', () => {
  it('sends the value and reports the save', async () => {
    const { value, state, load, save } = useSetting('templates')
    await load()
    value.value = { linkedin: 'modifié', reel: '' }
    await save()

    expect(lastWrite).toEqual({ linkedin: 'modifié', reel: '' })
    expect(state.value).toBe('enregistré')
  })

  it('sends nothing when there is nothing to send', async () => {
    // Saving a form never loaded would write null over the setting.
    const { state, save } = useSetting('templates')
    await save()

    expect(lastWrite).toBeNull()
    expect(state.value).toBe('repos')
  })

  it('says it failed, and does not claim to have saved', async () => {
    writeFails = true
    const { value, state, load, save } = useSetting('templates')
    await load()
    value.value = { linkedin: 'modifié', reel: '' }
    await save()

    expect(state.value).toBe('échec')
  })
})
