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
      assert.match(query, /order\(issue desc, publishedAt desc, slug\.current asc\)/)
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

test('Studio assigns a read-only next issue number within each site', async () => {
  const helper = await readFile(
    path.join(repoRoot, 'apps/studio/schemaTypes/shared/site-issue-number.ts'),
    'utf8',
  )
  const templates = await readFile(
    path.join(repoRoot, 'apps/studio/schemaTypes/shared/sites.ts'),
    'utf8',
  )
  const schema = await readFile(
    path.join(repoRoot, 'apps/studio/schemaTypes/documents/newsletter-issue.ts'),
    'utf8',
  )
  const structure = await readFile(path.join(repoRoot, 'apps/studio/structure/index.ts'), 'utf8')

  assert.match(helper, /site == \$site/)
  assert.match(helper, /order\(issue desc\)/)
  assert.match(helper, /\) \+ 1/)
  assert.match(helper, /perspective: 'raw'/)
  assert.match(helper, /issue == \$issue/)
  assert.match(helper, /!\(_id in \[\$draftId, \$publishedId\]\)/)
  assert.match(templates, /issue: await nextNewsletterIssueNumber\(site\.value, context\)/)
  assert.match(schema, /name: 'issue'[\s\S]*?readOnly: true/)
  assert.match(schema, /rule\.required\(\)\.integer\(\)\.positive\(\)/)
  assert.match(schema, /custom\(isIssueNumberUniqueWithinSite\)/)
  assert.match(structure, /field: 'issue', direction: 'desc'/)
})
