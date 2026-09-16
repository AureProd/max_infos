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

/** Written once: the same labels served the invitation and each row. */
const ROLES = [
  { label: 'Éditeur', value: 'editor' },
  { label: 'Technique', value: 'tech' },
]

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

  <form class="a-invite" @submit.prevent="invite">
    <label class="a-label" for="u-email">Inviter une adresse</label>
    <div class="a-toolbar">
      <input
        id="u-email"
        v-model="invitation.email"
        class="a-input"
        type="email"
        required
        placeholder="prenom@exemple.fr"
      />
      <Select
        v-model="invitation.role"
        :options="ROLES"
        option-label="label"
        option-value="value"
        aria-label="Rôle de l’invité"
      />
      <Button type="submit" label="Inviter" :disabled="busy" />
    </div>
  </form>

  <p v-if="failure" class="a-err">{{ failure }}</p>

  <!--
    Un vrai tableau : les colonnes s'alignent d'une ligne à l'autre, donc
    les rôles et les dernières visites se comparent d'un coup d'oeil. La
    liste précédente les empilait dans une ligne de méta, où rien ne se
    comparait.
  -->
  <DataTable
    :value="accounts ?? []"
    data-key="id"
    sort-field="email"
    :sort-order="1"
    size="small"
    striped-rows
  >
    <template #empty>
      <p class="a-empty">Aucun compte autorisé pour l'instant.</p>
    </template>

    <Column field="name" header="Compte" sortable>
      <template #body="{ data }">
        <span class="a-title">{{ data.name ?? data.email }}</span>
        <div class="a-sub">
          <span>{{ data.email }}</span>
          <span v-if="isMe(data.id)" class="a-tag is-info">vous</span>
        </div>
      </template>
    </Column>

    <Column field="role" header="Rôle" sortable style="width: 170px">
      <template #body="{ data }">
        <Select
          :model-value="data.role"
          :options="ROLES"
          option-label="label"
          option-value="value"
          :disabled="busy || isMe(data.id)"
          aria-label="Rôle"
          @update:model-value="(v: Role) => change(data.id, { role: v })"
        />
      </template>
    </Column>

    <Column field="active" header="État" sortable style="width: 120px">
      <template #body="{ data }">
        <Tag
          :value="data.active ? 'actif' : 'désactivé'"
          :severity="data.active ? 'success' : 'warn'"
        />
      </template>
    </Column>

    <Column field="lastLoginAt" header="Dernière visite" sortable style="width: 170px">
      <template #body="{ data }">
        <time v-if="data.lastLoginAt" class="a-date" :datetime="data.lastLoginAt">
          {{ frDate(data.lastLoginAt.slice(0, 10)) }}
        </time>
        <span v-else class="a-nil">jamais connecté</span>
      </template>
    </Column>

    <Column style="width: 1%">
      <template #body="{ data }">
        <div class="a-row-act">
          <Button
            severity="secondary"
            outlined
            size="small"
            :label="data.active ? 'Désactiver' : 'Réactiver'"
            :disabled="busy || isMe(data.id)"
            :title="why(data.id)"
            @click="change(data.id, { active: !data.active })"
          />
          <Button
            severity="danger"
            outlined
            size="small"
            label="Supprimer"
            :disabled="busy || isMe(data.id)"
            :title="why(data.id)"
            @click="remove(data.id, data.email)"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>
