/**
 * Point d'import unique du schéma.
 *
 * C'est ce que pointe drizzle.config.ts et ce que consomme `drizzle()`
 * pour l'API relationnelle. Tout nouveau fichier de schéma doit être
 * réexporté ici, sinon drizzle-kit ne le verra pas et générera une
 * migration vide.
 *
 * Les tables arrivent au commit suivant.
 */
export {}
