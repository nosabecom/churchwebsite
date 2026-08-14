import assert from 'node:assert/strict'
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  extractNewsletters,
  importableDocument,
  transformAll,
  transformNewsletter,
  validateDocuments,
} from '../lib/core.mjs'

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

test('draft state and asset references are transformed without a draft field', async () => {
  const record = (await extractNewsletters()).find(
    (source) => source.site === 'womanExcel' && source.frontmatter.image,
  )
  const transformed = transformNewsletter({
    ...record,
    frontmatter: {...record.frontmatter, draft: true},
  })
  assert.equal(transformed.migrationState, 'draft')
  assert.equal('draft' in transformed, false)

  const imported = importableDocument(transformed, 'image-asset-id')
  assert.equal(imported.migrationState, 'draft')
  assert.equal('migrationState' in imported.document, false)
  assert.deepEqual(imported.document.coverImage.asset, {
    _type: 'reference',
    _ref: 'image-asset-id',
  })
  assert.equal('assetSourcePath' in imported.document.coverImage, false)
})

test('validation derives counts and slug rules from the source inventory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'newsletter-migration-'))
  const frontmatter = (title) => `---
title: ${title}
publishedAt: 2026-09-01
excerpt: Development fixture
draft: false
---

## Heading

Fixture body.
`

  try {
    for (const [directory, title] of [
      ['apps/churchmain/src/content/newsletters', 'Church fixture'],
      ['apps/womanexcel/src/content/newsletters', 'Woman fixture'],
    ]) {
      await mkdir(path.join(root, directory), {recursive: true})
      await writeFile(path.join(root, directory, 'special-edition.md'), frontmatter(title))
    }

    const documents = await transformAll(root)
    const report = await validateDocuments(documents, root)
    assert.equal(report.ok, true, report.errors.join('\n'))
    assert.deepEqual(report.counts, {
      total: 2,
      bySite: {churchMain: 1, womanExcel: 1},
      assets: 0,
    })
  } finally {
    await rm(root, {recursive: true, force: true})
  }
})
