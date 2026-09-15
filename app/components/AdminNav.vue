<script setup lang="ts">
const { utilisateur, peut, deconnecter } = useUtilisateur()

/**
 * Les écrans techniques ne sont PAS dans le menu de Max.
 *
 * Ce masquage est du confort, pas une sécurité : le serveur refuse de
 * toute façon, et c'est lui seul qui protège. Mais un menu qui propose des
 * écrans interdits donne le sentiment d'un outil qui n'est pas fait pour
 * soi.
 */
const voitLaTechnique = peut('tech')

const ecrans = computed(() =>
  [
    { to: '/admin', libelle: 'Tableau de bord', tech: false },
    { to: '/admin/articles', libelle: 'Articles', tech: false },
    { to: '/admin/publications', libelle: 'Publications', tech: false },
    { to: '/admin/social', libelle: 'Réseaux', tech: false },
    { to: '/admin/home', libelle: 'Accueil', tech: false },
    { to: '/admin/about', libelle: 'À propos', tech: false },
    { to: '/admin/appearance', libelle: 'Apparence', tech: false },
    { to: '/admin/tech', libelle: 'Technique', tech: true },
  ].filter((e) => !e.tech || voitLaTechnique.value),
)
</script>

<template>
  <div class="admin-bar">
    <nav class="cnav">
      <NuxtLink v-for="e in ecrans" :key="e.to" :to="e.to">{{ e.libelle }}</NuxtLink>
    </nav>
    <div class="cluster">
      <span class="pill">{{ utilisateur?.name ?? utilisateur?.email }}</span>
      <slot />
      <button class="btn" type="button" @click="deconnecter">Se déconnecter</button>
    </div>
  </div>
</template>
