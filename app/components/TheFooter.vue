<script setup lang="ts">
import { SITE } from '~/data/site'
</script>

<template>
  <footer class="foot">
    <div class="wrap foot-in">
      <span>{{ SITE.name }} — {{ SITE.author }}. Sans publicité ni suivi.</span>
      <span>
        <a
          v-for="link in SITE.links"
          :key="link.label"
          :href="link.href"
          target="_blank"
          rel="noopener"
          style="margin-left: 16px"
          >{{ link.label }}</a
        >
      </span>
    </div>
  </footer>
</template>
