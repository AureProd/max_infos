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
    { to: '/redaction', libelle: 'Articles', tech: false },
    { to: '/redaction/publications', libelle: 'Publications', tech: false },
    { to: '/redaction/accueil', libelle: 'Accueil', tech: false },
    { to: '/redaction/apropos', libelle: 'À propos', tech: false },
    { to: '/redaction/apparence', libelle: 'Apparence', tech: false },
    { to: '/redaction/technique', libelle: 'Technique', tech: true },
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
