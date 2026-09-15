#!/usr/bin/env node
// Installs the Git hooks after `pnpm install` — but only where that makes
// sense.
//
// `lefthook install` needs a Git repository AND the git binary. Neither
// exists in the Docker image: the `deps` stage installs dependencies before
// copying the sources, and node:22-bookworm-slim ships no git. Calling it
// unconditionally made `pnpm install --frozen-lockfile` fail there, and
// with it the whole image build — so the CI image job and the deployment.
// Found by rebuilding the image, not by reading the file.
//
// A `|| true` would have hidden the failure everywhere, including where the
// hooks really should have been installed. So we check the one condition
// that distinguishes the two cases.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// The local binary rather than the PATH: pnpm puts node_modules/.bin on the
// PATH when it runs `prepare`, but nothing does when the script is called
// by hand — and a script that only works through its caller is a trap.
const LEFTHOOK = existsSync('node_modules/.bin/lefthook')
  ? 'node_modules/.bin/lefthook'
  : 'lefthook'

if (!existsSync('.git')) {
  console.log('[hooks] no .git here (Docker image, tarball): nothing to install')
  process.exit(0)
}

try {
  execFileSync(LEFTHOOK, ['install'], { stdio: 'inherit' })
} catch (error) {
  console.error(`[hooks] lefthook install failed: ${error.message}`)
  process.exit(1)
}
