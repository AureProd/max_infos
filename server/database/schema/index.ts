/**
 * The single import point of the schema.
 *
 * This is what drizzle.config.ts points at and what `drizzle()` consumes
 * for the relational API. Every new schema file must be re-exported here,
 * otherwise drizzle-kit will not see it and will generate an empty
 * migration.
 */

export * from './analytics'
export * from './article'
export * from './enums'
export * from './media'
export * from './relations'
export * from './setting'
export * from './social'
export * from './user'
