import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { fetchPageHtml, isFetchableUrl } from '../../server/utils/unfurl'

/** Un serveur jetable, sur un port que le système choisit. */
function serve(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ server: ReturnType<typeof createServer>; base: string }> {
  return new Promise((resolve) => {
    const server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ server, base: `http://127.0.0.1:${port}` })
    })
  })
}

/**
 * Ce que le serveur accepte d'aller chercher.
 *
 * La route de dépliage fait faire une requête AU SERVEUR, depuis une
 * adresse que l'utilisateur écrit. Sans garde, un éditeur pouvait lui
 * faire interroger le réseau interne du déploiement — la base, le tableau
 * de bord de Traefik, l'API de métadonnées d'un fournisseur de VPS sur
 * 169.254.169.254 — et lire dans la réponse ce qu'un `<title>` en dit.
 *
 * Le garde est une liste BLANCHE de schémas et une liste noire d'hôtes :
 * ce qui n'est pas du web public ne se déplie pas.
 */
describe('la cible d’un dépliage', () => {
  it('accepte une page web ordinaire', () => {
    expect(isFetchableUrl('https://www.linkedin.com/posts/quelquun_abc')).toBe(true)
    expect(isFetchableUrl('http://exemple.test/page')).toBe(true)
  })

  it('refuse tout ce qui n’est pas http', () => {
    for (const url of [
      'file:///etc/passwd',
      'ftp://exemple.test/x',
      'gopher://exemple.test/',
      'data:text/html,<title>x</title>',
    ])
      expect(isFetchableUrl(url), url).toBe(false)
  })

  it('refuse la boucle locale', () => {
    for (const url of [
      'http://127.0.0.1:3000/api/admin/users',
      'http://localhost:5432/',
      'http://[::1]/',
      'http://127.1/',
      'http://0.0.0.0/',
    ])
      expect(isFetchableUrl(url), url).toBe(false)
  })

  it('refuse les réseaux privés et le lien-local', () => {
    for (const url of [
      'http://10.0.0.5/',
      'http://172.16.3.1/',
      'http://192.168.1.1/',
      // L'API de métadonnées d'AWS, GCP et consorts. Le cas d'école.
      'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
      'http://[fd00::1]/',
    ])
      expect(isFetchableUrl(url), url).toBe(false)
  })

  it('refuse un nom de service interne, sans point', () => {
    // `http://db:5432` dans le réseau Docker du déploiement.
    expect(isFetchableUrl('http://db:5432/')).toBe(false)
    expect(isFetchableUrl('http://app/')).toBe(false)
  })

  it('refuse ce qui n’est pas une adresse', () => {
    expect(isFetchableUrl('pas une adresse')).toBe(false)
    expect(isFetchableUrl('')).toBe(false)
  })
})

/**
 * Les redirections, et la taille de ce qu'on lit.
 *
 * Suivre les sauts automatiquement contournait le garde : une page publique
 * qui renvoie vers une adresse interne fait repartir la requête sans
 * repasser par lui. Et rien ne bornait la lecture — une réponse énorme
 * était mise en mémoire en entier avant qu'on n'y cherche une balise.
 *
 * Éprouvé contre un vrai serveur, sur la boucle locale : d'où le `allow`
 * injecté, que le garde refuserait à raison.
 */
describe('aller chercher une page', () => {
  const ouvert = () => true

  it('suit une redirection, et lit la page d’arrivée', async () => {
    const { server, base } = await serve((req, res) => {
      if (req.url === '/depart') {
        res.writeHead(302, { location: '/arrivee' })
        res.end()
        return
      }
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<title>Arrivée</title>')
    })
    try {
      expect(await fetchPageHtml(`${base}/depart`, { allow: ouvert })).toContain('Arrivée')
    } finally {
      server.close()
    }
  })

  it('refuse un saut vers une adresse interdite', async () => {
    const { server, base } = await serve((_req, res) => {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' })
      res.end()
    })
    try {
      // `allow` n'ouvre QUE le serveur de test : le saut suivant repasse
      // par le vrai garde, et c'est lui qui doit dire non.
      const permis = (u: string) => u.startsWith(base) || isFetchableUrl(u)
      expect(await fetchPageHtml(`${base}/x`, { allow: permis })).toBeNull()
    } finally {
      server.close()
    }
  })

  it('abandonne après trop de sauts, et compte les siens', async () => {
    let appels = 0
    const { server, base } = await serve((_req, res) => {
      appels++
      res.writeHead(302, { location: '/encore' })
      res.end()
    })
    try {
      expect(await fetchPageHtml(`${base}/x`, { allow: ouvert })).toBeNull()
      // Le compte, et pas seulement l'abandon : sans borne, la boucle
      // terminait quand même — en suivant la chaîne jusqu'au bout.
      expect(appels).toBeLessThanOrEqual(4)
    } finally {
      server.close()
    }
  })

  it('borne ce qu’il lit', async () => {
    const { server, base } = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      // Deux mégaoctets, soit quatre fois la borne.
      res.end('x'.repeat(2 * 1024 * 1024))
    })
    try {
      const html = await fetchPageHtml(`${base}/x`, { allow: ouvert })
      expect(html).not.toBeNull()
      expect((html ?? '').length).toBeLessThan(1024 * 1024)
    } finally {
      server.close()
    }
  })
})
