/**
 * Point d'import unique du schéma.
 *
 * C'est ce que pointe drizzle.config.ts et ce que consomme `drizzle()` pour
 * l'API relationnelle. Tout nouveau file de schéma doit être réexporté
 * here, sinon drizzle-kit ne le verra pas et générera une migration vide.
 */

export * from './analytics'
export * from './article'
export * from './enums'
export * from './media'
export * from './relations'
export * from './setting'
export * from './social'
export * from './user'
