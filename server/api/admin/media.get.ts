import { desc } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { media } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'
import { stockageConfigure } from '~~/server/utils/stockage'

export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')

  const items = await useBase()
    .select({
      id: media.id,
      url: media.url,
      mime: media.mime,
      alt: media.alt,
      kind: media.kind,
      bytes: media.bytes,
      createdAt: media.createdAt,
    })
    .from(media)
    .orderBy(desc(media.createdAt))
    .limit(200)

  // Dit clairement si le stockage est configuré, pour que l'admin affiche
  // « R2 n'est pas branché » plutôt qu'un bouton qui échoue.
  return { items, stockage: stockageConfigure() }
})
