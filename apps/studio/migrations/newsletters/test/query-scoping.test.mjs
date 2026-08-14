import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import {repoRoot} from '../lib/core.mjs'

const queryFiles = [
  {
    path: 'apps/churchmain/src/data/newsletters.ts',
    owner: 'churchMain',
    otherOwner: 'womanExcel',
  },
  {
    path: 'apps/womanexcel/src/lib/newsletters.ts',
    owner: 'womanExcel',
    otherOwner: 'churchMain',
  },
]

for (const queryFile of queryFiles) {
  test(`${queryFile.owner} newsletter query has a literal ownership boundary`, async () => {
    const source = await readFile(path.join(repoRoot, queryFile.path), 'utf8')
    const queries = [
      ...source.matchAll(/defineQuery\((?:\/\* groq \*\/\s*)?(?:groq)?`([\s\S]*?)`\)/g),
    ].map((match) => match[1])
    const queryCalls = [...source.matchAll(/defineQuery\(/g)].length

    assert.ok(queries.length > 0, `${queryFile.path}: defineQuery template not found`)
    assert.equal(
      queries.length,
      queryCalls,
      `${queryFile.path}: every defineQuery call must use a literal template checked here`,
    )
    for (const query of queries) {
      assert.match(query, /_type == "newsletterIssue"/)
      assert.match(query, new RegExp(`site == "${queryFile.owner}"`))
      assert.doesNotMatch(query, new RegExp(`site == "${queryFile.otherOwner}"`))
      assert.match(query, /defined\(slug\.current\)/)
      assert.match(query, /defined\(publishedAt\)/)
    }
  })
}

test('Studio slug uniqueness is scoped to site and excludes both document variants', async () => {
  const source = await readFile(
    path.join(repoRoot, 'apps/studio/schemaTypes/shared/site-slug-is-unique.ts'),
    'utf8',
  )

  assert.match(source, /site == \$site/)
  assert.match(source, /slug\.current == \$slug/)
  assert.match(source, /!\(_id in \[\$draftId, \$publishedId\]\)/)
})
