import type { RouterConfig } from '@nuxt/schema'

// Remplace le `scrollBehavior` de l'ancien src/router/index.js : toute
// navigation ramène en haut de page.
export default {
  scrollBehavior: () => ({ top: 0 }),
} satisfies RouterConfig
