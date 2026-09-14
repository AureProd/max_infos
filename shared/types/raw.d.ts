/**
 * Les imports `?raw` de Vite ramènent le contenu brut d'un fichier sous
 * forme de chaîne. TypeScript ne connaît pas cette convention : il faut la
 * lui déclarer.
 *
 * Sert à charger les articles Markdown de la maquette. Disparaîtra au
 * lot 3, quand le contenu viendra de la base.
 */
declare module '*.md?raw' {
  const contenu: string
  export default contenu
}
