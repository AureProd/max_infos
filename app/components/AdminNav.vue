<script setup lang="ts">
const { user, peut, signOut } = useUser()

/**
 * Les écrans technical ne sont PAS dans le menu de Max.
 *
 * Ce masquage est du confort, pas une sécurité : le serveur refuse de
 * toute façon, et c'est lui seul qui protège. Mais un menu qui propose des
 * écrans interdits donne le sentiment d'un outil qui n'est pas fait pour
 * soi.
 */
const seesTech = peut('tech')

const screens = computed(() =>
  [
    { to: '/admin', label: 'Tableau de bord', tech: false },
    { to: '/admin/articles', label: 'Articles', tech: false },
    { to: '/admin/publications', label: 'Publications', tech: false },
    { to: '/admin/social', label: 'Réseaux', tech: false },
    { to: '/admin/home', label: 'Accueil', tech: false },
    { to: '/admin/about', label: 'À propos', tech: false },
    { to: '/admin/appearance', label: 'Apparence', tech: false },
    { to: '/admin/tech', label: 'Technique', tech: true },
  ].filter((e) => !e.tech || seesTech.value),
)
</script>

<template>
  <div class="admin-bar">
    <nav class="cnav">
      <NuxtLink v-for="e in screens" :key="e.to" :to="e.to">{{ e.label }}</NuxtLink>
    </nav>
    <div class="cluster">
      <span class="pill">{{ user?.name ?? user?.email }}</span>
      <slot />
      <button class="btn" type="button" @click="signOut">Se déconnecter</button>
    </div>
  </div>
</template>
