import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
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

test('Studio derives a read-only, collision-safe slug from the publication month', async () => {
  const input = await readFile(
    path.join(repoRoot, 'apps/studio/components/publication-date-slug-input.tsx'),
    'utf8',
  )
  const helperPath = path.join(repoRoot, 'apps/studio/schemaTypes/shared/newsletter-slug.ts')
  const helper = await readFile(helperPath, 'utf8')
  const schema = await readFile(
    path.join(repoRoot, 'apps/studio/schemaTypes/documents/newsletter-issue.ts'),
    'utf8',
  )
  const {resolveNewsletterSlug, slugFromPublicationDate} = await import(
    pathToFileURL(helperPath).href
  )

  const lookups = []
  let availability = {currentTaken: true, baseTaken: true}
  const client = {
    async fetch(query, params, options) {
      lookups.push({query, params, options})
      return availability
    },
  }
  const collisionSlug = await resolveNewsletterSlug({
    client,
    currentSlug: '2026-08',
    documentId: 'drafts.new-issue',
    issue: 10,
    publishedAt: '2026-08-24',
    site: 'churchMain',
  })
  availability = {currentTaken: false, baseTaken: false}
  const existingSlug = await resolveNewsletterSlug({
    client,
    currentSlug: '2026-08',
    documentId: 'existing-issue',
    issue: 8,
    publishedAt: '2026-08-01',
    site: 'churchMain',
  })
  const existingFallbackSlug = await resolveNewsletterSlug({
    client,
    currentSlug: '2026-08-10',
    documentId: 'same-month-issue',
    issue: 10,
    publishedAt: '2026-08-24',
    site: 'churchMain',
  })

  assert.match(input, /useFormValue\(\['publishedAt'\]\)/)
  assert.match(input, /resolveNewsletterSlug/)
  assert.match(input, /set\(\{_type: 'slug', current: generatedSlug\}\)/)
  assert.match(input, /renderDefault\(\{\.\.\.props, readOnly: true\}\)/)
  assert.equal(slugFromPublicationDate('2026-08-24'), '2026-08')
  assert.equal(collisionSlug, '2026-08-10')
  assert.equal(existingSlug, '2026-08')
  assert.equal(existingFallbackSlug, '2026-08-10')
  assert.equal(lookups.length, 3)
  assert.match(lookups[0].query, /site == \$site/)
  assert.match(lookups[0].query, /!\(_id in \[\$draftId, \$publishedId\]\)/)
  assert.deepEqual(lookups[0].params, {
    baseSlug: '2026-08',
    currentSlug: '2026-08',
    draftId: 'drafts.new-issue',
    publishedId: 'new-issue',
    site: 'churchMain',
  })
  assert.deepEqual(lookups[0].options, {perspective: 'raw'})
  assert.match(helper, /currentSlug === baseSlug \|\| currentSlug === fallbackSlug/)
  assert.match(schema, /name: 'slug'[\s\S]*?readOnly: true/)
  assert.match(schema, /source: 'publishedAt'/)
  assert.match(schema, /components: \{input: PublicationDateSlugInput\}/)
})

test('newsletter detail covers preserve portrait and landscape aspect ratios', async () => {
  const detailPages = [
    'apps/churchmain/src/pages/newsletters/[slug].astro',
    'apps/womanexcel/src/pages/newsletters/[slug].astro',
  ]

  for (const detailPage of detailPages) {
    const source = await readFile(path.join(repoRoot, detailPage), 'utf8')
    const coverImage = source.match(/<img src=\{newsletter\.coverImage\.url\}[^>]+>/)?.[0]

    assert.ok(coverImage, `${detailPage} must render the cover image`)
    assert.match(coverImage, /width=\{newsletter\.coverImage\.width\}/)
    assert.match(coverImage, /height=\{newsletter\.coverImage\.height\}/)
    assert.match(coverImage, /h-auto/)
    assert.match(coverImage, /max-w-full/)
    assert.doesNotMatch(coverImage, /object-cover/)
  }
})
