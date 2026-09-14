import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Doit être déclaré ICI ET dans drizzle() côté client : sinon la
  // génération des migrations et l'exécution divergent silencieusement.
  // On écrit `coverMediaId` en TypeScript, la colonne s'appelle
  // `cover_media_id`.
  casing: 'snake_case',
  dbCredentials: {
    // Sans préfixe NUXT_ : drizzle-kit n'est pas Nitro.
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
})
