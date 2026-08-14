import assert from 'node:assert/strict'
import {readFile, stat} from 'node:fs/promises'
import path from 'node:path'

import {normalizeRenderedText, renderedHrefs} from '../lib/artifacts.mjs'
import {extractNewsletters, repoRoot, transformAll} from '../lib/core.mjs'

const siteDirectories = {
  churchMain: 'apps/churchmain',
  womanExcel: 'apps/womanexcel',
}

const records = await extractNewsletters()
const documents = await transformAll()

for (const [site, appDirectory] of Object.entries(siteDirectories)) {
  const siteRecords = records.filter((record) => record.site === site)
  const archivePath = path.join(repoRoot, appDirectory, 'dist/newsletters/index.html')
  await stat(archivePath)
  const archive = await readFile(archivePath, 'utf8')

  for (const record of siteRecords) {
    assert.match(archive, new RegExp(`href=["']/newsletters/${record.slug}/["']`))

    const detailPath = path.join(
      repoRoot,
      appDirectory,
      'dist/newsletters',
      record.slug,
      'index.html',
    )
    await stat(detailPath)
    const html = await readFile(detailPath, 'utf8')
    const text = normalizeRenderedText(html.replace(/<[^>]+>/g, ' '))
    const document = documents.find(
      (candidate) => candidate.site === site && candidate.slug.current === record.slug,
    )

    assert.ok(document, `${site}:${record.slug}: transformed document not found`)
    assert.ok(
      text.includes(normalizeRenderedText(document.title)),
      `${site}:${record.slug}: title missing from build`,
    )
    assert.ok(
      text.includes(normalizeRenderedText(document.excerpt)),
      `${site}:${record.slug}: excerpt missing from build`,
    )
    for (const block of document.body) {
      const blockText = block.children.map((child) => child.text).join('')
      assert.ok(
        text.includes(normalizeRenderedText(blockText)),
        `${site}:${record.slug}: body block missing: ${blockText}`,
      )
    }
    if (document.relatedLink)
      assert.ok(
        renderedHrefs(html).includes(document.relatedLink.href),
        `${site}:${record.slug}: related link missing`,
      )
    if (document.coverImage)
      assert.match(
        html,
        /(?:cdn\.sanity\.io\/images\/|\/images\/placeholds\/)/,
        `${site}:${record.slug}: cover image missing`,
      )
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      routes: records.length,
      bySite: Object.fromEntries(
        Object.keys(siteDirectories).map((site) => [
          site,
          records.filter((record) => record.site === site).length,
        ]),
      ),
    },
    null,
    2,
  ),
)
