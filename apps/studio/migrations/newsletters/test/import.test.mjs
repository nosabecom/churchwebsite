import assert from 'node:assert/strict'
import test from 'node:test'

import {transformAll} from '../lib/core.mjs'
import {assertSafeDataset, upsertNewsletter} from '../lib/import.mjs'

test('dataset guard accepts explicit non-production targets only', () => {
  for (const dataset of [
    'dev',
    'development',
    'development-rcc55',
    'review',
    'review-rcc55',
    'staging',
    'test',
  ]) {
    assert.doesNotThrow(() => assertSafeDataset(dataset, dataset))
  }

  for (const dataset of [
    'production',
    'prod',
    'production-review',
    'review-production',
    'newsletter',
  ]) {
    assert.throws(() => assertSafeDataset(dataset, dataset), /Refusing to write/)
  }
  assert.throws(() => assertSafeDataset('development', 'review'), /Refusing to write/)
})

function fakeClient({existingId, staleExists = false} = {}) {
  const calls = {create: [], replace: [], delete: [], commit: []}
  const transaction = {
    createOrReplace(document) {
      calls.replace.push(document)
      return this
    },
    delete(id) {
      calls.delete.push(id)
      return this
    },
    async commit(options) {
      calls.commit.push(options)
    },
  }
  return {
    calls,
    async fetch(query) {
      return query.includes('migrationMetadata.sourceKey') ? existingId : staleExists
    },
    async create(document, options) {
      calls.create.push({document, options})
      return {_id: 'generated-id'}
    },
    transaction() {
      return transaction
    },
  }
}

test('new draft imports create a complete deferred document then atomically move it to drafts', async () => {
  const source = (await transformAll()).find((document) => !document.coverImage)
  const document = {...source, migrationState: 'draft'}
  const client = fakeClient()
  const result = await upsertNewsletter(client, document, async () => undefined)

  assert.equal(client.calls.create.length, 1)
  assert.equal(client.calls.create[0].document.title, document.title)
  assert.ok(client.calls.create[0].document.body.length > 0)
  assert.equal('_id' in client.calls.create[0].document, false)
  assert.deepEqual(client.calls.create[0].options, {visibility: 'deferred'})
  assert.equal(client.calls.replace[0]._id, 'drafts.generated-id')
  assert.deepEqual(client.calls.delete, ['generated-id'])
  assert.deepEqual(client.calls.commit, [{visibility: 'sync'}])
  assert.deepEqual(result, {
    sourceKey: document.migrationMetadata.sourceKey,
    id: 'drafts.generated-id',
    state: 'draft',
  })
})

test('rerunning a published import reuses the Sanity-generated base ID and removes its draft', async () => {
  const document = (await transformAll()).find((source) => !source.coverImage)
  const client = fakeClient({existingId: 'drafts.existing-id', staleExists: true})
  const result = await upsertNewsletter(client, document, async () => undefined)

  assert.equal(client.calls.create.length, 0)
  assert.equal(client.calls.replace[0]._id, 'existing-id')
  assert.deepEqual(client.calls.delete, ['drafts.existing-id'])
  assert.equal(result.id, 'existing-id')
  assert.equal(result.state, 'published')
})
