import type { IgMedia } from '../../../shared/types/content'

/**
 * Instagram integration.
 *
 * Instagram no longer exposes any post without authentication: the Basic
 * Display API closed at the end of 2024 and the Graph API requires a
 * professional account, a Meta application and a token to renew.
 *
 * The path that works without a token is the OFFICIAL EMBED: the post is
 * rendered by Instagram in an iframe, with its media, its caption and its
 * original carousel arrows. The content is mounted in JavaScript in the
 * browser — so it does not show when fetching the URL from the command
 * line, only in a real page.
 *
 * To add a post: copy its address from Instagram and put the identifier
 * following /p/ or /reel/ into `shortcode`.
 */
export const IG_MEDIA: IgMedia[] = [
  {
    id: 'ig-1',
    type: 'reel',
    kind: 'p',
    shortcode: 'DdGUF5XJbhE',
    url: 'https://www.instagram.com/p/DdGUF5XJbhE/',
    articleId: 'cri-dequoy',
    date: '2026-09-11',
  },
  {
    id: 'ig-2',
    type: 'reel',
    kind: 'p',
    shortcode: 'DdCLb6pzJVt',
    url: 'https://www.instagram.com/p/DdCLb6pzJVt/',
    articleId: 'ni-dici-ni-dailleurs',
    date: '2026-09-08',
  },
]

export const findMedia = (id: string): IgMedia | undefined => IG_MEDIA.find((m) => m.id === id)
