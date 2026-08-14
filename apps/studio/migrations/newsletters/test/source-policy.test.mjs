import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSanityDevReloadPlugin,
  enforceSanityProductionConfig,
  getSafeNewsletterHref,
  isExternalNewsletterHref,
  loadNewsletterSource,
  memoizePromise,
} from '@churchwebsite/newsletters'

test('Vercel production requires the private production Sanity configuration', () => {
  const base = {enabled: true, deployment: 'production', label: 'Church Main'}

  assert.throws(() => enforceSanityProductionConfig(base), /PROJECT_ID/)
  assert.throws(() => enforceSanityProductionConfig({...base, projectId: 'project'}), /DATASET/)
  assert.throws(
    () =>
      enforceSanityProductionConfig({
        ...base,
        projectId: 'project',
        dataset: 'development',
        token: 'viewer-token',
      }),
    /must be production/,
  )
  assert.equal(
    enforceSanityProductionConfig({
      ...base,
      projectId: 'project',
      dataset: 'production',
      token: 'viewer-token',
    }),
    true,
  )
  assert.equal(
    enforceSanityProductionConfig({
      enabled: true,
      deployment: 'preview',
      projectId: 'project',
      dataset: 'development',
      label: 'Church Main',
    }),
    false,
  )
})

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

test('enabled Sanity fails closed for missing configuration and fetch failures', async () => {
  let markdownCalls = 0
  const base = {
    enabled: true,
    loadMarkdown: async () => {
      markdownCalls += 1
      return ['markdown']
    },
    missingConfigurationMessage: 'missing',
    fetchFailureMessage: 'failed',
  }

  await assert.rejects(
    loadNewsletterSource({...base, configured: false, loadSanity: async () => ['sanity']}),
    /missing/,
  )
  await assert.rejects(
    loadNewsletterSource({
      ...base,
      configured: true,
      loadSanity: async () => {
        throw new Error('network')
      },
    }),
    /failed/,
  )
  assert.equal(markdownCalls, 0)
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

test('development Sanity mutations trigger a debounced Vite full reload', async () => {
  let observer
  let closeHandler
  let unsubscribed = false
  const listenCalls = []
  const messages = []
  const serverEvents = []
  const logs = []
  const client = {
    listen(...args) {
      listenCalls.push(args)
      return {
        subscribe(nextObserver) {
          observer = nextObserver
          return {
            unsubscribe() {
              unsubscribed = true
            },
          }
        },
      }
    },
  }
  const plugin = createSanityDevReloadPlugin({
    enabled: true,
    client,
    query: '*[_type == "newsletterIssue" && site == $site]',
    params: {site: 'churchMain'},
    label: 'Church Main',
    debounceMs: 0,
  })

  plugin.configureServer({
    config: {
      logger: {
        info(message) {
          logs.push(message)
        },
        error(message) {
          logs.push(message)
        },
      },
    },
    ws: {
      send(message) {
        messages.push(message)
      },
    },
    environments: {
      ssr: {
        hot: {
          send(event, payload) {
            serverEvents.push({event, payload})
          },
        },
      },
      client: {
        hot: {
          send(message) {
            messages.push(message)
          },
        },
      },
    },
    httpServer: {
      once(event, handler) {
        assert.equal(event, 'close')
        closeHandler = handler
      },
    },
  })

  assert.equal(plugin.apply, 'serve')
  assert.deepEqual(listenCalls, [
    [
      '*[_type == "newsletterIssue" && site == $site]',
      {site: 'churchMain'},
      {
        events: ['mutation'],
        includeResult: false,
        includeMutations: false,
        visibility: 'query',
        tag: 'newsletter.dev-reload',
      },
    ],
  ])
  observer.next()
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.deepEqual(serverEvents, [{event: 'astro:content-changed', payload: {}}])
  assert.deepEqual(messages, [{type: 'full-reload', path: '*'}])
  assert.match(logs.join('\n'), /reloading the browser/)
  closeHandler()
  assert.equal(unsubscribed, true)
})

test('development reload listener stays inactive when Sanity is disabled', () => {
  let listenCalls = 0
  const plugin = createSanityDevReloadPlugin({
    enabled: false,
    client: {
      listen() {
        listenCalls += 1
      },
    },
    query: '*[_type == "newsletterIssue"]',
    label: 'Church Main',
  })

  plugin.configureServer({
    config: {logger: {info() {}, error() {}}},
    ws: {send() {}},
  })
  assert.equal(listenCalls, 0)
})
