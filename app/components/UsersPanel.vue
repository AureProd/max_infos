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
// `peut('developer')` is false during server rendering.
onMounted(() => refresh())

/** Written once: the same labels served the invitation and each row. */
const ROLES = [
  { label: 'Éditeur', value: 'editor' },
  { label: 'Développeur', value: 'developer' },
]

const invitation = ref<{ email: string; role: Role }>({ email: '', role: 'editor' })
const busy = ref(false)
const { ok, fail } = useNotify()
const confirmDialog = useConfirm()

/** L'adresse copiée, et laquelle : le retour tient deux secondes. */
const copied = ref<number | null>(null)

async function copyEmail(id: number, email: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(email)
    copied.value = id
    setTimeout(() => {
      if (copied.value === id) copied.value = null
    }, 2000)
  } catch {
    // Le presse-papiers est refusé hors contexte sécurisé. L'adresse reste
    // affichée et sélectionnable : rien n'est perdu.
    fail('Le navigateur a refusé le presse-papiers', 'Copie impossible')
  }
}

const isMe = (id: number): boolean => id === me.value?.id

const why = (id: number): string =>
  isMe(id) ? 'Un compte ne peut pas retirer son propre accès.' : ''

/** Every action goes through here: one place to report, one place to refresh. */
async function run(action: () => Promise<unknown>, said: string): Promise<void> {
  busy.value = true
  try {
    await action()
    await refresh()
    ok(said)
  } catch (e) {
    fail(e, 'Opération refusée')
  } finally {
    busy.value = false
  }
}

const invite = () =>
  run(async () => {
    await $fetch('/api/admin/users', { method: 'POST', body: invitation.value })
    invitation.value = { email: '', role: 'editor' }
  }, 'Compte ajouté')

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
  run(
    () => $fetch<unknown>(`/api/admin/users/${id}`, { method: 'PUT', body: changes }),
    changes.active === undefined
      ? 'Rôle modifié'
      : changes.active
        ? 'Compte réactivé'
        : 'Compte désactivé',
  )

function remove(id: number, email: string): void {
  // Deactivating loses nothing and is undone in a click; deletion is final.
  // The wording says so, because the button does not.
  confirmDialog.require({
    header: 'Supprimer ce compte',
    message: `« ${email} » sera supprimé définitivement. Ses téléversements et ses réglages perdront leur auteur. Pour couper l’accès sans rien perdre, préfère Désactiver.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    rejectProps: { severity: 'secondary', outlined: true },
    accept: () =>
      run(() => $fetch<unknown>(`/api/admin/users/${id}`, { method: 'DELETE' }), 'Compte supprimé'),
  })
}
</script>

<template>
  <!-- Dans une carte, comme le bloc Sauvegarde juste au-dessus : les deux
       blocs de l'écran se présentaient différemment, l'un encadré, l'autre
       posé à même la page. -->
  <section class="admin-card">
    <h2>Comptes autorisés</h2>
    <p class="hint">
      Personne ne s’inscrit : une adresse doit figurer ici pour que la connexion Google soit
      acceptée. Désactiver un compte le déconnecte à sa requête suivante.
    </p>

    <!--
      Tout sur une ligne : l'adresse, le rôle, l'ajout. Le libellé au-dessus
      et les trois contrôles dessous prenaient deux rangées pour un geste, et
      le champ, le menu et le bouton n'avaient pas la même hauteur — le menu
      portait la police du système, tous les autres celle du back-office.
    -->
    <form class="a-invite" @submit.prevent="invite">
      <InputText
        id="u-email"
        v-model="invitation.email"
        type="email"
        required
        placeholder="prenom@exemple.fr"
        aria-label="Adresse à autoriser"
      />
      <Select
        v-model="invitation.role"
        :options="ROLES"
        option-label="label"
        option-value="value"
        aria-label="Rôle"
      />
      <Button type="submit" icon="pi pi-plus" label="Ajouter" :disabled="busy" />
    </form>

    <!--
      Un vrai tableau : les colonnes s'alignent d'une ligne à l'autre, donc
      les rôles et les dernières visites se comparent d'un coup d'oeil. La
      liste précédente les empilait dans une ligne de méta, où rien ne se
      comparait.
    -->
    <div class="a-scroll-x">
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

        <Column field="name" header="Compte" sortable :pt="cell('Compte')">
          <template #body="{ data }">
            <!-- `.a-title` peint en bleu souligné au survol : le nom d'un
                 compte en portait la classe et se donnait des airs de lien
                 alors qu'il ne mène nulle part. -->
            <span class="a-strong">{{ data.name ?? data.email }}</span>
            <div class="a-sub">
              <span>{{ data.email }}</span>
              <Button
                v-tooltip.top="'Copier l’adresse'"
                severity="secondary"
                text
                size="small"
                :icon="copied === data.id ? 'pi pi-check' : 'pi pi-copy'"
                aria-label="Copier l’adresse"
                @click="copyEmail(data.id, data.email)"
              />
              <span v-if="isMe(data.id)" class="a-tag is-info">vous</span>
            </div>
          </template>
        </Column>

        <Column field="role" header="Rôle" sortable class="a-col-lg" :pt="cell('Rôle')">
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

        <Column field="active" header="État" sortable class="a-col-md" :pt="cell('État')">
          <template #body="{ data }">
            <Tag
              :value="data.active ? 'actif' : 'désactivé'"
              :severity="data.active ? 'success' : 'warn'"
            />
          </template>
        </Column>

        <Column field="createdAt" header="Ajouté le" sortable class="a-col-md" :pt="cell('Ajouté le')">
          <template #body="{ data }">
            <time class="a-date" :datetime="data.createdAt">
              {{ frDate(data.createdAt.slice(0, 10)) }}
            </time>
          </template>
        </Column>

        <Column field="lastLoginAt" header="Dernière visite" sortable class="a-col-lg" :pt="cell('Dernière visite')">
          <template #body="{ data }">
            <time v-if="data.lastLoginAt" class="a-date" :datetime="data.lastLoginAt">
              {{ frDate(data.lastLoginAt.slice(0, 10)) }}
            </time>
            <span v-else class="a-nil">jamais connecté</span>
          </template>
        </Column>

        <Column class="a-col-fit" :pt="cell('')">
          <template #body="{ data }">
            <div class="a-row-act">
              <!-- La couleur suit l'ÉTAT du compte : couper un accès actif
                   est une action d'avertissement, le rendre est une action
                   ordinaire. Le même bouton gris pour les deux ne disait pas
                   lequel des deux on s'apprêtait à faire. -->
              <Button
                v-tooltip.top="why(data.id) || (data.active ? 'Couper l’accès' : 'Rendre l’accès')"
                :severity="data.active ? 'warn' : 'success'"
                outlined
                size="small"
                :icon="data.active ? 'pi pi-ban' : 'pi pi-check-circle'"
                :aria-label="data.active ? 'Désactiver' : 'Réactiver'"
                :disabled="busy || isMe(data.id)"
                @click="change(data.id, { active: !data.active })"
              />
              <Button
                v-tooltip.top="why(data.id) || 'Supprimer définitivement'"
                severity="danger"
                outlined
                size="small"
                icon="pi pi-trash"
                aria-label="Supprimer"
                :disabled="busy || isMe(data.id)"
                @click="remove(data.id, data.email)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
  </section>
</template>
