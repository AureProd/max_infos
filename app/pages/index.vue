<script setup lang="ts">
import { SITE } from '#shared/data/site'

useSeoMeta({
  title: SITE.name,
  description: SITE.tagline,
})
</script>

<template>
  <!-- Page d'attente du lot 2. La vraie page d'accueil arrive avec la
       conversion des vues, puis se branche sur l'API au lot 3. -->
  <section class="wrap">
    <h1>{{ SITE.name }}</h1>
    <p>{{ SITE.tagline }}</p>
  </section>
</template>
