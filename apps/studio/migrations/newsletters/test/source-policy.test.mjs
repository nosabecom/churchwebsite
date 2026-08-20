import assert from 'node:assert/strict'
import test from 'node:test'

import {createSanityDevReloadPlugin, loadNewsletterSource} from '@churchwebsite/newsletters'

test('newsletter loading uses the configured source without mixing fallbacks', async () => {
  let sanityCalls = 0
  let markdownCalls = 0
  const loadSanity = async () => {
    sanityCalls += 1
    return []
  }
  const loadMarkdown = async () => {
    markdownCalls += 1
    return ['markdown']
  }

  assert.deepEqual(
    await loadNewsletterSource({
      enabled: false,
      configured: true,
      loadSanity,
      loadMarkdown,
    }),
    ['markdown'],
  )
  assert.deepEqual(
    await loadNewsletterSource({
      enabled: true,
      configured: true,
      loadSanity,
      loadMarkdown,
    }),
    [],
  )
  await assert.rejects(
    loadNewsletterSource({
      enabled: true,
      configured: false,
      loadSanity,
      loadMarkdown,
      missingConfigurationMessage: 'missing',
    }),
    /missing/,
  )

  assert.equal(sanityCalls, 1)
  assert.equal(markdownCalls, 1)
})

test('development Sanity changes reload the browser', async () => {
  let observer
  const messages = []
  const serverEvents = []
  const plugin = createSanityDevReloadPlugin({
    enabled: true,
    client: {
      listen() {
        return {
          subscribe(nextObserver) {
            observer = nextObserver
            return {unsubscribe() {}}
          },
        }
      },
    },
    query: '*[_type == "newsletterIssue" && site == $site]',
    params: {site: 'churchMain'},
    label: 'Church Main',
    debounceMs: 0,
  })

  plugin.configureServer({
    config: {logger: {info() {}, error() {}}},
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
    httpServer: {once() {}},
  })
  observer.next()
  await new Promise((resolve) => setTimeout(resolve, 5))

  assert.deepEqual(serverEvents, [{event: 'astro:content-changed', payload: {}}])
  assert.deepEqual(messages, [{type: 'full-reload', path: '*'}])
})
