<script setup>
import TheMasthead from '@/components/TheMasthead.vue'
import TheFooter from '@/components/TheFooter.vue'
</script>

<template>
  <TheMasthead />
  <main>
    <RouterView />
  </main>
  <TheFooter />
</template>
