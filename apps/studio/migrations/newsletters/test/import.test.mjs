import assert from 'node:assert/strict'
import test from 'node:test'

import {transformAll} from '../lib/core.mjs'
import {assertProductionDataset, assertSafeDataset, upsertNewsletter} from '../lib/import.mjs'

test('newsletter imports require an explicitly confirmed safe target', () => {
  assert.doesNotThrow(() => assertSafeDataset('development', 'development'))
  assert.throws(() => assertSafeDataset('production', 'production'), /Refusing to write/)
  assert.throws(() => assertSafeDataset('development', 'review'), /Refusing to write/)

  assert.doesNotThrow(() =>
    assertProductionDataset('production', 'production', 'RCC-55-RCC-57-approved'),
  )
  assert.throws(
    () => assertProductionDataset('production', 'production', undefined),
    /Refusing production write/,
  )
})

test('rerunning an import updates the existing Sanity document', async () => {
  const calls = {create: 0, replace: [], delete: []}
  const transaction = {
    createOrReplace(document) {
      calls.replace.push(document)
      return this
    },
    delete(id) {
      calls.delete.push(id)
      return this
    },
    async commit() {},
  }
  const client = {
    async fetch(query) {
      return query.includes('migrationMetadata.sourceKey') ? 'drafts.existing-id' : true
    },
    async create() {
      calls.create += 1
    },
    transaction() {
      return transaction
    },
  }
  const document = (await transformAll()).find((source) => !source.coverImage)
  const result = await upsertNewsletter(client, document, async () => undefined)

  assert.equal(calls.create, 0)
  assert.equal(calls.replace[0]._id, 'existing-id')
  assert.deepEqual(calls.delete, ['drafts.existing-id'])
  assert.equal(result.id, 'existing-id')
})
