import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Must be declared HERE AND in drizzle() on the client side: otherwise
  // migration generation and runtime drift apart silently. We write
  // `coverMediaId` in TypeScript, the column is called `cover_media_id`.
  casing: 'snake_case',
  dbCredentials: {
    // No NUXT_ prefix: drizzle-kit is not Nitro.
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
})
