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

test.describe('the article list', () => {
  test('opens the editor from anywhere on the row', async ({ page }) => {
    await page.goto('/admin/articles')
    const row = page.locator('tbody tr').first()
    await expect(row).toBeVisible()

    // Une cellule de DATE, aussi loin que possible du titre : c'est le clic
    // qui ne faisait rien, parce qu'il fallait viser le lien.
    await row.locator('td.a-date').first().click()
    await expect(page).toHaveURL(/\/admin\/[^/]+$/)
    await expect(page).not.toHaveURL(/\/admin\/articles$/)
  })

  /**
   * Un SEUL test touche cette ligne.
   *
   * L'action et le retour étaient éprouvés séparément, et les deux
   * publiaient le même article : exécutés en parallèle contre une base
   * partagée, ils se marchaient dessus une fois sur trois. C'est le même
   * geste, il se mesure d'un coup.
   */
  test('acts on the row without leaving, and says that it worked', async ({ page, viewport }) => {
    await page.goto('/admin/articles')

    /*
     * Chaque largeur agit sur SA ligne.
     *
     * Les trois projets tournent en parallèle contre la même base. Visant
     * tous la première ligne, ils publiaient le même article en même temps
     * — et publier change `updatedAt`, donc l'ordre de la liste : la ligne
     * changeait sous le curseur. Un titre est stable, un rang ne l'est pas.
     */
    const rows = page.locator('tbody tr')
    const mine = rows.nth(({ 390: 0, 820: 1 } as Record<number, number>)[viewport?.width ?? 0] ?? 2)
    await expect(mine).toBeVisible()
    await mine.getByRole('button', { name: /Publier|Dépublier/ }).click()

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
    await page.goto('/admin/tags')
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
    expect(shape.label).toContain('Articles')
  })
})
