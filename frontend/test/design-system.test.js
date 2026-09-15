import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/styles.css', 'utf8')

describe('Design system and responsive hardening', () => {
  it('centralizes required visual tokens and reduced motion', () => {
    for (const token of ['--color-bg', '--color-surface', '--color-text', '--color-accent', '--font-body', '--space-4', '--radius-lg', '--shadow-sm', '--icon-size', '--control-height', '--layout-width', '--breakpoint-sm', '--motion-fast']) {
      expect(css).toContain(token)
    }
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('contains mobile/tablet/desktop hardening and long-text rules', () => {
    expect(css).toContain('@media (max-width: 1100px)')
    expect(css).toContain('@media (max-width: 820px)')
    expect(css).toContain('@media (max-width: 600px)')
    expect(css).toContain('overflow-wrap: anywhere')
    expect(css).toContain('min-width: 0')
  })
})
