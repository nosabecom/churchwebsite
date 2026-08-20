import assert from 'node:assert/strict'
import test from 'node:test'

import {transformAll, validateDocuments} from '../lib/core.mjs'

test('newsletter migration is deterministic and produces valid documents', async () => {
  const first = await transformAll()
  const second = await transformAll()
  const report = await validateDocuments(first)

  assert.deepEqual(first, second)
  assert.equal(report.ok, true, report.errors.join('\n'))
  assert.deepEqual(report.counts, {
    total: 8,
    bySite: {churchMain: 4, womanExcel: 4},
    assets: 4,
  })
})
