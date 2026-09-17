<script setup lang="ts">
import { isCurrentScreen } from '~/utils/admin-nav'

/**
 * The back-office chrome, in ONE place.
 *
 * Until now every admin page rebuilt it by hand, under the PUBLIC masthead:
 * the screen showed two navigations stacked, one for visitors and one for
 * Max. The layout removes that duplication.
 *
 * It is LIGHT, while the public site is dark. A working tool reads better
 * in daylight, and the contrast says at a glance which side one is on —
 * publishing or editing.
 */
const { user, peut, signOut } = useUser()

/**
 * The technical screens are NOT in Max's menu.
 *
 * This hiding is comfort, not security: the server refuses anyway, and it
 * alone protects. But a menu offering forbidden screens makes a tool feel
 * like it was not built for you.
 */
const seesTech = peut('developer')

const route = useRoute()

const screens = computed(() =>
  [
    { to: '/admin', label: 'Tableau de bord', tech: false },
    { to: '/admin/articles', label: 'Articles', tech: false },
    { to: '/admin/publications', label: 'Publications', tech: false },
    { to: '/admin/social', label: 'Réseaux', tech: false },
    { to: '/admin/about', label: 'À propos', tech: false },
    { to: '/admin/tech', label: 'Technique', tech: true },
  ].filter((e) => !e.tech || seesTech.value),
)

/**
 * Sous 900px, les six écrans tiennent dans UN select.
 *
 * Les deux formes coexistent dans le document et c'est le CSS qui montre
 * l'une ou l'autre : brancher sur la largeur en JavaScript demanderait de
 * connaître la fenêtre au rendu serveur, qui ne la connaît pas — et
 * l'hydratation casserait. `display: none` retire aussi la forme cachée de
 * l'arbre d'accessibilité, donc rien n'est annoncé deux fois.
 */
const here = computed(
  () => screens.value.find((e) => isCurrentScreen(route.path, e.to))?.to ?? '/admin',
)
</script>

<template>
  <div class="admin-shell admin-ui">
    <header class="admin-head">
      <div class="admin-head-in">
        <NuxtLink class="admin-brand" to="/admin">
          <span class="admin-dot" />
          <span>Back-office</span>
        </NuxtLink>

        <nav class="admin-menu" aria-label="Sections du back-office">
          <NuxtLink
            v-for="e in screens"
            :key="e.to"
            :to="e.to"
            :aria-current="isCurrentScreen(route.path, e.to) ? 'page' : undefined"
          >
            {{ e.label }}
          </NuxtLink>
        </nav>

        <select
          class="admin-menu-select"
          aria-label="Sections du back-office"
          :value="here"
          @change="navigateTo(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="e in screens" :key="e.to" :value="e.to">{{ e.label }}</option>
        </select>

        <div class="admin-who">
          <span class="admin-user">{{ user?.name ?? user?.email }}</span>
          <!-- The role, shown rather than guessed: which screens are
               missing from the menu is otherwise a puzzle. -->
          <span v-if="seesTech" class="admin-tag">développeur</span>
          <!--
            Deux libellés, un long et un court : sur un téléphone, « Voir le
            site ↗ » et « Se déconnecter » à eux seuls dépassent la largeur
            de l'écran. Le nom accessible, lui, ne change pas — il vient de
            l'aria-label, et non du texte qui se voit.
          -->
          <NuxtLink class="admin-out" to="/" target="_blank" aria-label="Voir le site">
            <span class="admin-out-long">Voir le site ↗</span>
            <span class="admin-out-short" aria-hidden="true">↗</span>
          </NuxtLink>
          <button
            class="admin-out"
            type="button"
            aria-label="Se déconnecter"
            @click="signOut"
          >
            <span class="admin-out-long">Se déconnecter</span>
            <span class="admin-out-short" aria-hidden="true">Sortir</span>
          </button>
        </div>
      </div>
    </header>

    <main class="admin-main">
      <slot />
    </main>

    <!--
      Le retour à l'utilisateur, monté une fois pour tout le back-office.

      Ils sont TÉLÉPORTÉS dans <body>, donc hors de `.admin-shell` : c'est
      `.admin-ui` qui porte le thème, et sans lui ils retomberaient sur la
      feuille du site. Le `pt` les y rattache.
    -->
    <Toast position="top-right" :pt="{ root: { class: 'admin-ui' } }" />
    <ConfirmDialog :pt="{ root: { class: 'admin-ui' } }" />
  </div>
</template>

<style>
/* Importée ici plutôt que dans nuxt.config : la feuille du back-office ne
   part pas dans le bundle des pages publiques, qui ne l'utilisent jamais. */
@import '~/assets/css/admin.css' layer(site);
</style>
