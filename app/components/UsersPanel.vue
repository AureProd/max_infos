<script setup lang="ts">
import { frDate } from '#shared/utils/format'
import type { Role } from '#shared/utils/roles'

/**
 * The accounts allowed to sign in.
 *
 * Google AUTHENTICATES; this list AUTHORISES. Nobody signs themselves up:
 * an address absent from here is refused, whatever Google says about it.
 *
 * Every refusal shown here is ALSO refused by the server — the disabled
 * buttons are comfort, like `peut()` in the menu. Nothing on this screen
 * protects anything; `server/utils/users.ts` does.
 */

const { user: me } = useUser()

const { data: accounts, refresh } = await useFetch('/api/admin/users', {
  key: 'admin-users',
  immediate: false,
})

// The component is only mounted for a `tech`, and only after hydration —
// `peut('tech')` is false during server rendering.
onMounted(() => refresh())

const invitation = ref<{ email: string; role: Role }>({ email: '', role: 'editor' })
const busy = ref(false)
const failure = ref('')

const isMe = (id: number): boolean => id === me.value?.id

const why = (id: number): string =>
  isMe(id) ? 'Un compte ne peut pas retirer son propre accès.' : ''

/** Every action goes through here: one place to report, one place to refresh. */
async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true
  failure.value = ''
  try {
    await action()
    await refresh()
  } catch (e) {
    failure.value = (e as { statusMessage?: string }).statusMessage ?? 'Opération refusée'
  } finally {
    busy.value = false
  }
}

const invite = () =>
  run(async () => {
    await $fetch('/api/admin/users', { method: 'POST', body: invitation.value })
    invitation.value = { email: '', role: 'editor' }
  })

/**
 * `$fetch<unknown>` on these two, and it is NOT the usual laziness.
 *
 * CLAUDE.md asks that the type be left to Nitro, so a field renamed on the
 * server breaks the page. That rule is about the ANSWER — and here we read
 * none: both calls are followed by a refresh, which is what actually carries
 * the new state.
 *
 * Written otherwise, the route inference explodes on « Excessive stack
 * depth », the trap server/utils/instagram.ts already records. A plain
 * `string` is worse still: Nitro then tries to match it against every route
 * of the application. useSettings.ts writes its PUT the same way.
 */
const change = (id: number, changes: { role?: Role; active?: boolean }) =>
  run(() => $fetch<unknown>(`/api/admin/users/${id}`, { method: 'PUT', body: changes }))

function remove(id: number, email: string): void {
  // Deactivating loses nothing and is undone in a click; deletion is final.
  // The wording says so, because the button does not.
  const warning =
    `Supprimer définitivement « ${email} » ?\n\n` +
    'Ses téléversements et ses réglages perdront leur auteur.\n' +
    'Pour couper l’accès sans rien perdre, préfère Désactiver.'
  if (!confirm(warning)) return
  void run(() => $fetch<unknown>(`/api/admin/users/${id}`, { method: 'DELETE' }))
}
</script>

<template>
  <h2>Comptes autorisés</h2>
  <p class="hint">
    Personne ne s’inscrit : une adresse doit figurer ici pour que la connexion Google soit
    acceptée. Désactiver un compte le déconnecte à sa requête suivante.
  </p>

  <form class="field" @submit.prevent="invite">
    <label for="u-email">Inviter une adresse</label>
    <div class="cluster">
      <input
        id="u-email"
        v-model="invitation.email"
        type="email"
        required
        placeholder="prenom@exemple.fr"
      />
      <select v-model="invitation.role" aria-label="Rôle de l’invité">
        <option value="editor">Éditeur</option>
        <option value="tech">Technique</option>
      </select>
      <button class="btn btn-primary" type="submit" :disabled="busy">Inviter</button>
    </div>
  </form>

  <p v-if="failure" class="err">{{ failure }}</p>

  <ul class="list">
    <li v-for="c in accounts ?? []" :key="c.id">
      <div class="entry">
        <div>
          <h3>{{ c.name ?? c.email }}</h3>
          <div class="meta">
            <span>{{ c.email }}</span>
            <span class="pill">{{ c.role === 'tech' ? 'technique' : 'éditeur' }}</span>
            <span v-if="!c.active" class="pill">désactivé</span>
            <span v-if="isMe(c.id)" class="pill">vous</span>
            <time v-if="c.lastLoginAt" :datetime="c.lastLoginAt">
              vu le {{ frDate(c.lastLoginAt.slice(0, 10)) }}
            </time>
            <span v-else>jamais connecté</span>
          </div>
        </div>

        <div class="cluster">
          <select
            :value="c.role"
            :disabled="busy || isMe(c.id)"
            :title="why(c.id)"
            aria-label="Rôle"
            @change="change(c.id, { role: ($event.target as HTMLSelectElement).value as Role })"
          >
            <option value="editor">Éditeur</option>
            <option value="tech">Technique</option>
          </select>
          <button
            class="btn"
            type="button"
            :disabled="busy || isMe(c.id)"
            :title="why(c.id)"
            @click="change(c.id, { active: !c.active })"
          >
            {{ c.active ? 'Désactiver' : 'Réactiver' }}
          </button>
          <button
            class="btn"
            type="button"
            :disabled="busy || isMe(c.id)"
            :title="why(c.id)"
            @click="remove(c.id, c.email)"
          >
            Supprimer
          </button>
        </div>
      </div>
    </li>
  </ul>
</template>
