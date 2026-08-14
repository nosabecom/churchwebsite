import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getSafeNewsletterHref,
  isExternalNewsletterHref,
  loadNewsletterSource,
  memoizePromise,
} from '@churchwebsite/newsletters'

test('flag off reads Markdown without attempting Sanity', async () => {
  let sanityCalls = 0
  const result = await loadNewsletterSource({
    enabled: false,
    configured: true,
    loadSanity: async () => {
      sanityCalls += 1
      return ['sanity']
    },
    loadMarkdown: async () => ['markdown'],
  })
  assert.deepEqual(result, ['markdown'])
  assert.equal(sanityCalls, 0)
})

test('missing configuration and fetch failures fall back to Markdown', async () => {
  const warnings = []
  const base = {
    enabled: true,
    loadMarkdown: async () => ['markdown'],
    warn: (...message) => warnings.push(message),
    missingConfigurationMessage: 'missing',
    fetchFailureMessage: 'failed',
  }

  assert.deepEqual(
    await loadNewsletterSource({...base, configured: false, loadSanity: async () => ['sanity']}),
    ['markdown'],
  )
  assert.deepEqual(
    await loadNewsletterSource({
      ...base,
      configured: true,
      loadSanity: async () => {
        throw new Error('network')
      },
    }),
    ['markdown'],
  )
  assert.deepEqual(
    warnings.map(([message]) => message),
    ['missing', 'failed'],
  )
})

test('a successful empty Sanity response remains authoritative', async () => {
  let markdownCalls = 0
  const result = await loadNewsletterSource({
    enabled: true,
    configured: true,
    loadSanity: async () => [],
    loadMarkdown: async () => {
      markdownCalls += 1
      return ['markdown']
    },
  })
  assert.deepEqual(result, [])
  assert.equal(markdownCalls, 0)
})

test('memoized loaders keep a build on one source decision', async () => {
  let calls = 0
  const load = memoizePromise(async () => {
    calls += 1
    return ['sanity']
  })
  const [first, second] = await Promise.all([load(), load()])
  assert.deepEqual(first, ['sanity'])
  assert.equal(first, second)
  assert.equal(calls, 1)
})

test('newsletter hrefs reject unsafe schemes and identify external links', () => {
  assert.equal(getSafeNewsletterHref('/contact'), '/contact')
  assert.equal(getSafeNewsletterHref('mailto:hello@example.com'), 'mailto:hello@example.com')
  assert.equal(getSafeNewsletterHref('https://example.com'), 'https://example.com')
  assert.equal(getSafeNewsletterHref('//example.com'), undefined)
  assert.equal(getSafeNewsletterHref('javascript:alert(1)'), undefined)
  assert.equal(isExternalNewsletterHref('https://example.com'), true)
  assert.equal(isExternalNewsletterHref('/contact'), false)
})
