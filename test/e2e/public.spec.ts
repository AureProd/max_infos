import { expect, test } from '@playwright/test'

/**
 * What the public pages must SHOW.
 *
 * The order of the home page, the tag rail on one line, the share dialog,
 * the pared-down sign-in: none of these can be checked by reading the HTML
 * the server sends. They are questions about position, about wrapping, and
 * about what a click does.
 */

test.describe('the home page', () => {
  test('lays its sections out in the order Max asked for', async ({ page }) => {
    await page.goto('/')

    // Présentation, la une, les réseaux, la recherche. Et rien après : le
    // bandeau de titres défilants a été retiré, il redonnait une seconde
    // liste de titres à qui venait d'en choisir un.
    const order = await page.evaluate(() => {
      const mark = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? NaN
      return {
        hero: mark('.hero'),
        front: mark('.front'),
        networks: mark('.pubs'),
        search: mark('.filters'),
        marquee: document.querySelector('.marquee'),
        cue: document.querySelector('.scroll-cue'),
      }
    })

    expect(order.hero).toBeLessThan(order.front)
    expect(order.front).toBeLessThan(order.networks)
    expect(order.networks).toBeLessThan(order.search)
    expect(order.marquee).toBeNull()
    expect(order.cue).toBeNull()
  })

  test('keeps the tags on a single line, most used first', async ({ page }) => {
    await page.goto('/')
    const tags = page.locator('.tags .tag')
    await expect(tags.first()).toBeVisible()

    // Une seule ligne : tous les boutons partagent le même sommet. Ils
    // occupaient trois rangées au milieu de la page.
    const tops = await tags.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    )
    expect(new Set(tops).size).toBe(1)
  })

  test('scrolls the tag rail without scrolling the page', async ({ page }) => {
    await page.goto('/')
    const page_ = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      rail: (() => {
        const el = document.querySelector('.tags') as HTMLElement | null
        return el ? getComputedStyle(el).overflowX : ''
      })(),
    }))
    expect(page_.doc, 'la page elle-même ne doit jamais défiler de côté').toBe(true)
    expect(page_.rail).toBe('auto')
  })
})

test.describe('an article', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('a[href^="/article/"]').first().click()
    await expect(page).toHaveURL(/\/article\//)
  })

  test('opens the reading column at the width of the Substack', async ({ page }) => {
    const width = await page
      .locator('.prose')
      .evaluate((el) => Math.round(el.getBoundingClientRect().width))
    // 728px : la largeur réelle du Substack, gravée dans l'URL de ses
    // images. Sur un téléphone la colonne est plus étroite, jamais plus large.
    expect(width).toBeLessThanOrEqual(728)
  })

  test('signs the article the way the Substack does', async ({ page }) => {
    // Retour et partage, titre, sous-titre, signature, puis la couverture.
    const tops = await page.evaluate(() => {
      const at = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? NaN
      return {
        top: at('.article-top'),
        title: at('.article h1'),
        dek: at('.article .dek'),
        signature: at('.signature'),
        cover: at('.article > .frame'),
      }
    })
    expect(tops.top).toBeLessThan(tops.title)
    expect(tops.title).toBeLessThan(tops.dek)
    expect(tops.dek).toBeLessThan(tops.signature)
    expect(tops.signature).toBeLessThan(tops.cover)
  })

  test('puts the author and the tags on the same line', async ({ page, viewport }) => {
    // Sur un téléphone ils s'empilent, et c'est ce qu'il faut : trois
    // pastilles ne tiennent pas à côté d'un nom sur 390 px.
    test.skip((viewport?.width ?? 0) < 700, 'ils s’empilent sur un téléphone, à raison')

    // Ils occupaient deux bandes séparées par un filet, pour six mots.
    const sameLine = await page.evaluate(() => {
      const name = document.querySelector('.signature-name')?.getBoundingClientRect()
      const tags = document.querySelector('.article-tags')?.getBoundingClientRect()
      if (!name || !tags) return null
      // Se chevauchent verticalement : ils partagent la rangée.
      return name.top < tags.bottom && tags.top < name.bottom
    })
    expect(sameLine).toBe(true)
  })

  test('offers the share button on the line of the back link', async ({ page }) => {
    const bar = await page.evaluate(() => {
      const back = document.querySelector('.article-top .back')?.getBoundingClientRect()
      const share = document.querySelector('.article-top .share-open')?.getBoundingClientRect()
      if (!back || !share) return null
      return {
        sameLine: back.top < share.bottom && share.top < back.bottom,
        rightOf: share.left > back.right,
      }
    })
    expect(bar?.sameLine).toBe(true)
    expect(bar?.rightOf).toBe(true)
  })

  test('shares through a dialog that closes on Escape', async ({ page }) => {
    // Deux boutons partagent l'article : un sous la signature, un au pied.
    // Le premier est celui qu'on éprouve.
    const dialog = page.locator('dialog.share-box').first()
    await expect(dialog).toBeHidden()

    await page.locator('.share-open').first().click()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('a[href*="linkedin.com"]')).toBeVisible()

    // L'adresse proposée à la copie est bien celle de l'article, et pas
    // celle de la page d'accueil d'où l'on vient.
    await expect(dialog.locator('.share-copy input')).toHaveValue(/\/article\//)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})

test.describe('the sign-in page', () => {
  test('offers one action and explains nothing', async ({ page }) => {
    await page.goto('/login')

    await expect(page.locator('a[href="/api/auth/google"]')).toBeVisible()

    // Elle décrivait le fonctionnement de la liste d'autorisation à qui
    // n'y figure pas. Soit on peut se connecter, soit on ne peut pas.
    const text = (await page.locator('.signin').innerText()).toLowerCase()
    expect(text).not.toContain('autoris')
    expect(text).not.toContain('jb')
  })
})

test.describe('the masthead', () => {
  test('reaches the back-office by an icon that still has a name', async ({ page }) => {
    await page.goto('/')
    const link = page.locator('.nav a[href="/admin"]')
    await expect(link).toHaveAttribute('aria-label', 'Rédaction')
    // Une icône sans texte : le libellé ne doit plus prendre la place d'un
    // onglet, mais il doit rester lisible par un lecteur d'écran.
    expect((await link.innerText()).trim()).toBe('')
  })
})
