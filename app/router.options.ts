import type { RouterConfig } from '@nuxt/schema'

// Replaces the `scrollBehavior` of the old src/router/index.js: every
// navigation returns to the top of the page.
export default {
  scrollBehavior: () => ({ top: 0 }),
} satisfies RouterConfig
