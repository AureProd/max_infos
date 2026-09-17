<script setup lang="ts">
import { frDate, nb } from '#shared/utils/format'

definePageMeta({ middleware: 'admin', layout: 'admin' })

/**
 * The social network accounts, configured by Max.
 *
 * Connect, order, hide, disconnect: everything that decides what the home
 * page shows. The displayed identity — name, picture, bio — is NOT editable
 * here: it comes from Instagram, and that is what keeps it true. Attaching
 * a post to an article stays in the Publications screen.
 */
const route = useRoute()
/** Return message from the OAuth flow, carried by the URL. */
const back = computed(() => route.query.instagram as string | undefined)

const { data: accounts, refresh } = await useFetch('/api/admin/social-accounts', {
  key: 'comptes-sociaux',
})

const state = ref<'repos' | 'enregistrement' | 'enregistré' | 'échec'>('repos')
const message = ref('')

/**
 * No explicit type on `$fetch`: Nitro's is inferred from the handler, so
 * that a field renamed server-side makes `pnpm typecheck` fail here. A type
 * written by hand would have accepted anything.
 */
async function set(
  id: number,
  changes: { visible?: boolean; position?: number; postsOnHome?: number },
): Promise<void> {
  state.value = 'enregistrement'
  try {
    await $fetch(`/api/admin/social-accounts/${id}`, { method: 'PUT', body: changes })
    await refresh()
    state.value = 'enregistré'
  } catch (e) {
    state.value = 'échec'
    message.value = (e as { statusMessage?: string }).statusMessage ?? 'Enregistrement impossible'
  }
}

/** Swaps two accounts, writing only the two positions. */
async function move(i: number, sens: -1 | 1): Promise<void> {
  const list = accounts.value ?? []
  const here = list[i]
  const la = list[i + sens]
  if (!here || !la) return
  await set(here.id, { position: la.position })
  await set(la.id, { position: here.position })
}

const syncTask = ref<number | 'tous' | null>(null)

async function syncPosts(account?: number): Promise<void> {
  syncTask.value = account ?? 'tous'
  message.value = ''
  try {
    const summary = await $fetch('/api/admin/instagram/sync', {
      method: 'POST',
      query: account ? { account } : {},
    })
    const failures = summary.accounts.filter((c) => c.error)
    message.value = failures.length
      ? `${summary.fresh} nouvelle(s). En échec : ${failures.map((c) => `@${c.username} (${c.error})`).join(', ')}`
      : `${summary.views} publication(s) vue(s), ${summary.fresh} nouvelle(s).`
    await refresh()
  } catch (e) {
    message.value = (e as { statusMessage?: string }).statusMessage ?? 'Synchronisation impossible'
  } finally {
    syncTask.value = null
  }
}

/**
 * Disconnecting ERASES the account's posts and their attachments.
 *
 * Hence the confirmation announcing the exact count: it is final, and
 * resyncing after reconnecting would not give the article attachments back.
 */
async function signOut(account: {
  id: number
  username: string | null
  nbPublications: number
}): Promise<void> {
  const accord = confirm(
    `Déconnecter @${account.username} supprimera aussi ses ${account.nbPublications} publication(s) et leurs liens vers les articles. Cette action est définitive.`,
  )
  if (!accord) return
  await $fetch(`/api/admin/social-accounts/${account.id}`, { method: 'DELETE' })
  await refresh()
}

useSeoMeta({ title: 'Réseaux', robots: 'noindex, nofollow' })
</script>

<template>
  <div>

    <div class="admin-title">
      <div>
        <h1>Réseaux</h1>
      </div>
      <div class="admin-actions">
          <span v-if="state === 'enregistré'" class="a-tag is-ok">enregistré</span>
          <span v-else-if="state === 'échec'" class="a-err">échec</span>
          <Button
            severity="secondary"
            outlined
            :label="syncTask === 'tous' ? 'Synchronisation…' : 'Tout synchroniser'"
            :disabled="syncTask !== null || !(accounts ?? []).length"
            @click="syncPosts()"
          />
          <a class="a-btn a-btn-primary" href="/api/admin/instagram/connect">Connecter un compte</a>
      </div>
    </div>

      <p v-if="back === 'ok'" class="a-tag is-ok">Le compte est connecté.</p>
      <p v-else-if="back === 'refus'" class="a-err">
        L'autorisation a été refusée côté Instagram.
      </p>
      <p v-if="message" class="hint">{{ message }}</p>

      <p class="hint">
        Chaque compte affiché occupe sa propre section sur la page d'accueil, dans l'ordre
        ci-dessous. Le nom et la photo sont ceux du compte Instagram : ils se corrigent là-bas.
        Pour rattacher une publication à un article, voir
        <NuxtLink to="/admin/publications">Publications</NuxtLink>.
      </p>

      <!--
        Un vrai tableau, comme les comptes autorisés : les colonnes
        s'alignent d'une ligne à l'autre. La liste précédente empilait une
        case à cocher nue, un champ numérique nu et des boutons dépareillés
        dans une rangée en flex — seul écran du back-office resté ainsi.
        Pas de tri : l'ordre des lignes EST celui de la page d'accueil.
      -->
      <DataTable :value="accounts ?? []" data-key="id" size="small" striped-rows>
        <template #empty>
          <p class="a-empty">
            Aucun compte connecté. « Connecter un compte » ouvre l'autorisation Instagram.
          </p>
        </template>

        <Column header="Compte">
          <template #body="{ data }">
            <div class="cluster">
              <img
                v-if="data.avatarUrl"
                class="avatar"
                :src="data.avatarUrl"
                :alt="`@${data.username}`"
              />
              <div>
                <a class="a-title" :href="data.url ?? undefined" target="_blank" rel="noopener">
                  @{{ data.username }}
                </a>
                <div class="a-sub">
                  <span v-if="data.displayName">{{ data.displayName }}</span>
                  <span>{{ nb(data.nbPublications) }} publication(s)</span>
                  <span v-if="data.followers">{{ nb(data.followers) }} abonné(e)s</span>
                </div>
              </div>
            </div>
          </template>
        </Column>

        <Column header="Jeton" style="width: 200px">
          <template #body="{ data }">
            <Tag v-if="!data.signedIn" severity="danger" value="absent — reconnecter" />
            <Tag
              v-else-if="data.jetonAlerte"
              severity="warn"
              :value="`${data.jetonAgeJours} jours — à renouveler`"
            />
            <Tag v-else-if="data.jetonAgeJours === null" severity="success" value="connecté" />
            <Tag v-else severity="success" :value="`${data.jetonAgeJours} jours`" />
          </template>
        </Column>

        <Column header="Synchronisé" style="width: 130px">
          <template #body="{ data }">
            <time v-if="data.lastSyncAt" class="a-date" :datetime="data.lastSyncAt">
              {{ frDate(data.lastSyncAt.slice(0, 10)) }}
            </time>
            <span v-else class="a-nil">jamais</span>
          </template>
        </Column>

        <Column header="Sur l'accueil" style="width: 120px">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.visible"
              aria-label="Afficher ce compte sur l'accueil"
              @update:model-value="(v: boolean) => set(data.id, { visible: v })"
            />
          </template>
        </Column>

        <Column header="Publications" style="width: 130px">
          <template #body="{ data }">
            <InputNumber
              :model-value="data.postsOnHome"
              :min="1"
              :max="50"
              show-buttons
              button-layout="horizontal"
              :input-style="{ width: '2.5rem' }"
              aria-label="Nombre de publications sur l'accueil"
              @update:model-value="(v: number) => set(data.id, { postsOnHome: v })"
            />
          </template>
        </Column>

        <Column header="Ordre" style="width: 110px">
          <template #body="{ data, index }">
            <div class="a-row-act">
              <Button
                severity="secondary"
                outlined
                size="small"
                label="↑"
                :disabled="index === 0"
                aria-label="Monter"
                @click="move(index, -1)"
              />
              <Button
                severity="secondary"
                outlined
                size="small"
                label="↓"
                :disabled="index === (accounts ?? []).length - 1"
                aria-label="Descendre"
                @click="move(index, 1)"
              />
            </div>
          </template>
        </Column>

        <Column style="width: 1%">
          <template #body="{ data }">
            <div class="a-row-act">
              <Button
                severity="secondary"
                outlined
                size="small"
                :label="syncTask === data.id ? 'Synchronisation…' : 'Synchroniser'"
                :disabled="syncTask !== null"
                @click="syncPosts(data.id)"
              />
              <Button
                severity="danger"
                outlined
                size="small"
                label="Déconnecter"
                @click="signOut(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>

  </div>
</template>

<style scoped>
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
</style>
