import { expect, test } from '@playwright/test'
import { SESSION_FILE } from './helpers'

/**
 * The back-office, as Max actually uses it.
 *
 * Not a vitrine: a tool, and one he opens on a phone. What matters here is
 * that a list is usable at 390px, that a click lands where it looks like it
 * should, and that an action says whether it worked.
 */
test.use({ storageState: SESSION_FILE })

/**
 * Chaque test qui ÉCRIT se fabrique son article.
 *
 * Les trois largeurs tournent en parallèle contre la même base, et la liste
 * est triée sur `updatedAt` — que publier comme écrire change. Viser « la
 * première ligne », puis « la ligne portant ce titre », revenait toujours à
 * viser quelque chose qu'un test voisin déplaçait ou réécrivait. Un article
 * à soi ne se dispute avec personne.
 */
async function ownArticle(page: import('@playwright/test').Page, what: string) {
  const title = `${what} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const created = await page.request.post('/api/admin/articles', {
    data: { title, bodyHtml: '<p>Un corps de test.</p>', tags: [] },
  })
  expect(created.ok(), 'la création de l’article de test a échoué').toBe(true)
  return { title, slug: ((await created.json()) as { slug: string }).slug }
}

test.describe('the article list', () => {
  test('opens the editor from anywhere on the row', async ({ page }) => {
    const { title, slug } = await ownArticle(page, 'Ouvrir la ligne')
    await page.goto('/admin/articles')
    // L'HYDRATATION, et non le rendu : un clic envoyé avant elle tombe sur
    // du HTML sans gestionnaire, et ne fait simplement rien.
    await page.waitForLoadState('networkidle')

    const row = page.locator('tbody tr').filter({ hasText: title })
    await expect(row).toBeVisible()

    // Une cellule de DATE, aussi loin que possible du titre : c'est le clic
    // qui ne faisait rien, parce qu'il fallait viser le lien.
    await row.locator('td.a-date').first().click()
    await expect(page).toHaveURL(new RegExp(`/admin/${slug}$`))
  })

  test('acts on the row without leaving, and says that it worked', async ({ page }) => {
    const { title } = await ownArticle(page, 'Publier depuis la liste')
    await page.goto('/admin/articles')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tbody tr').filter({ hasText: title })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /Publier|Dépublier/ }).click()

    // Le bouton agit ; il n'emmène pas ailleurs.
    await expect(page).toHaveURL(/\/admin\/articles$/)

    const toast = page.locator('.p-toast-message').first()
    await expect(toast).toBeVisible()

    // En haut À DROITE : six écrans imprimaient leur résultat dans un coin
    // différent, souvent celui que Max ne regardait pas.
    const box = await page.locator('.p-toast').first().boundingBox()
    const view = page.viewportSize()
    expect(box).not.toBeNull()
    expect(box?.y).toBeLessThan(200)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan((view?.width ?? 0) / 2)
  })
})

test.describe('the tag screen', () => {
  test('is a screen of its own, reachable from the menu', async ({ page }) => {
    await page.goto('/admin')
    // Sous 900px le menu est un <select> ; les deux existent dans le
    // document, et c'est le CSS qui montre l'un ou l'autre.
    const inMenu = await page.locator('a[href="/admin/tags"], option[value="/admin/tags"]').count()
    expect(inMenu).toBeGreaterThan(0)

    await page.goto('/admin/tags')
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  })
})

/**
 * A table on a phone.
 *
 * Five columns on a 390px screen either overflow sideways or squeeze every
 * word to one letter per line. The tables written by hand already unfolded
 * into stacked cards; the library's ones did not, and were the reason the
 * back-office still scrolled sideways.
 */
test.describe('a table on a phone', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 640, 'ne concerne que le téléphone')

  test('unfolds into stacked cards rather than scrolling sideways', async ({ page }) => {
    await page.goto('/admin/tech')
    const firstRow = page.locator('.p-datatable-tbody > tr').first()
    await expect(firstRow).toBeVisible()

    const shape = await firstRow.evaluate((tr) => ({
      row: getComputedStyle(tr).display,
      header: getComputedStyle(tr.closest('table')?.querySelector('thead') as Element).display,
      // Le libellé de colonne est repris sur la cellule : empilée, elle a
      // perdu son en-tête.
      label: getComputedStyle(tr.querySelectorAll('td')[1] as Element, '::before').content,
    }))

    expect(shape.row).toBe('block')
    expect(shape.header).toBe('none')
    expect(shape.label).toContain('Rôle')
  })

  /**
   * Un tag n'a qu'un nom et un chiffre.
   *
   * La carte empilée convient à un compte ou à un article — un titre, puis
   * ses champs nommés. Ici, « ARTICLES » écrit au-dessus d'un « 2 » prenait
   * une rangée pour un caractère : le nombre passe en haut à droite, sans
   * libellé, et le filet sous le nom disparaît.
   */
  test('puts a tag’s count beside its name, without naming the column', async ({ page }) => {
    await page.goto('/admin/tags')
    const firstRow = page.locator('.p-datatable-tbody > tr').first()
    await expect(firstRow).toBeVisible()

    const shape = await firstRow.evaluate((tr) => {
      const cells = [...tr.querySelectorAll('td')]
      const count = cells.find((td) => td.dataset.label === 'Articles') as Element
      return {
        row: getComputedStyle(tr).display,
        label: getComputedStyle(count, '::before').content,
        rule: getComputedStyle(cells[0] as Element).borderBottomWidth,
        sameLine:
          Math.abs(
            (cells[0] as Element).getBoundingClientRect().top - count.getBoundingClientRect().top,
          ) < 4,
      }
    })

    expect(shape.row).toBe('grid')
    expect(shape.label).toBe('none')
    expect(shape.rule).toBe('0px')
    expect(shape.sameLine).toBe(true)
  })
})
