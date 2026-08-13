import assert from 'node:assert/strict'
import test from 'node:test'

import {extractNewsletters, transformAll, validateDocuments} from '../lib/core.mjs'

test('extracts all newsletter sources with site-qualified keys', async () => {
  const records = await extractNewsletters()
  assert.equal(records.length, 8)
  assert.deepEqual(
    Object.fromEntries(
      ['churchMain', 'womanExcel'].map((site) => [
        site,
        records.filter((record) => record.site === site).length,
      ]),
    ),
    {churchMain: 4, womanExcel: 4},
  )
  assert.equal(new Set(records.map((record) => record.sourceKey)).size, 8)
})

test('transformation is deterministic and validates all assets', async () => {
  const first = await transformAll()
  const second = await transformAll()
  assert.deepEqual(first, second)
  const report = await validateDocuments(first)
  assert.deepEqual(report, await validateDocuments(second))
  assert.equal(report.ok, true, report.errors.join('\n'))
  assert.deepEqual(report.counts, {
    total: 8,
    bySite: {churchMain: 4, womanExcel: 4},
    assets: 4,
  })
})

test('Portable Text keys differ between sites with colliding slugs', async () => {
  const documents = await transformAll()
  const may = documents.filter((document) => document.slug.current === '2026-05')
  assert.equal(may.length, 2)
  assert.notEqual(may[0].body[0]._key, may[1].body[0]._key)
  assert.ok(may.every((document) => document.body.every((block) => block._type === 'block')))
})
