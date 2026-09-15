import { desc } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { media } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { storageConfigured } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  const items = await useDatabase()
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

  // States plainly whether storage is configured, so the admin can show
  // « R2 is not plugged in » rather than a button that fails.
  return { items, stockage: storageConfigured() }
})
