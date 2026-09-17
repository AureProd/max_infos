import { expect, test } from '@playwright/test'
import { SESSION_FILE } from './helpers'

/**
 * Écrire un article.
 *
 * Ce que le `<textarea>` de Markdown ne donnait pas, et qu'aucun test
 * serveur ne peut voir : une mise en forme appliquée à une sélection, un
 * Ctrl+Z qui annule cette mise en forme et non des caractères, et un
 * document qui reste du HTML de bout en bout.
 */
test.use({ storageState: SESSION_FILE })

/** Ouvre le premier article de la liste, dans l'éditeur. */
async function openEditor(page: import('@playwright/test').Page) {
  await page.goto('/admin/articles')
  await page.locator('tbody tr td.a-date').first().click()
  await expect(page).toHaveURL(/\/admin\/[^/]+$/)
  const sheet = page.locator('.a-prose')
  await expect(sheet).toBeVisible()
  return sheet
}

test.describe('the writing sheet', () => {
  test('shows the text laid out, not its markup', async ({ page }) => {
    const sheet = await openEditor(page)

    // Le corps est du HTML rendu : un intertitre est un intertitre, pas
    // deux dièses au milieu du texte.
    await expect(sheet.locator('p').first()).toBeVisible()
    const text = await sheet.innerText()
    expect(text).not.toContain('**')
    expect(text).not.toMatch(/\[[^\]]+\]\(https?:/)
  })

  test('applies a format to the selection, and says so in the toolbar', async ({ page }) => {
    const sheet = await openEditor(page)
    const bold = page.getByRole('button', { name: 'Gras', exact: true })

    // Un mot, sélectionné puis mis en gras.
    await sheet.locator('p').first().click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    await bold.click()

    await expect(sheet.locator('strong').first()).toBeVisible()
    // Le bouton dit ce que porte le curseur : sans lui, on ne sait pas si
    // l'on est déjà en gras avant de taper.
    await expect(bold).toHaveClass(/is-on/)
  })

  test('undoes that format with Ctrl+Z', async ({ page }) => {
    const sheet = await openEditor(page)
    const before = await sheet.locator('strong').count()

    await sheet.locator('p').first().click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    await page.getByRole('button', { name: 'Gras', exact: true }).click()
    await expect(sheet.locator('strong')).toHaveCount(before + 1)

    // Le raccourci, et non le bouton : c'est celui que Max utilisera.
    await page.keyboard.press('Control+z')
    await expect(sheet.locator('strong')).toHaveCount(before)
  })

  test('inserts a Substack link as a button, not as a bare address', async ({ page }) => {
    const sheet = await openEditor(page)

    const subscribe = page.getByRole('button', { name: 'S’abonner à la newsletter' })
    // Le bouton ne paraît que sur un article venu du Substack.
    test.skip((await subscribe.count()) === 0, 'cet article ne vient pas du Substack')

    await sheet.locator('p').first().click()
    await subscribe.click()

    const cta = sheet.locator('p.article-cta a').first()
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /substack\.com/)
    await expect(cta).toHaveText(/abonner/i)
  })
})

/**
 * L'aperçu montre ce qui sera publié.
 *
 * Il passe par la MÊME fonction d'assainissement que l'enregistrement : un
 * aperçu rendu autrement finirait par mentir.
 */
test.describe('the preview', () => {
  test('opens on the article, dressed like the site', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Aperçu' }).click()

    const preview = page.locator('.a-preview-win, .preview, [role="dialog"]').first()
    await expect(preview).toBeVisible()
    await page.keyboard.press('Escape')
  })
})
