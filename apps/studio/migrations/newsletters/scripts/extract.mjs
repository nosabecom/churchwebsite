import path from 'node:path'

import {writeJson} from '../lib/artifacts.mjs'
import {extractNewsletters, repoRoot, transformNewsletter, validateDocuments} from '../lib/core.mjs'

const outputDirectory = path.resolve(
  process.argv[2] ?? path.join(repoRoot, 'tmp/newsletter-migration'),
)
const extracted = await extractNewsletters()
const transformed = extracted.map(transformNewsletter)
const report = await validateDocuments(transformed)

await writeJson(path.join(outputDirectory, 'extracted/newsletters.json'), extracted)
await writeJson(path.join(outputDirectory, 'transformed/newsletters.json'), transformed)
await writeJson(path.join(outputDirectory, 'reports/validation.json'), report)

console.log(JSON.stringify({outputDirectory, ...report.counts, ok: report.ok}, null, 2))
if (!report.ok) process.exitCode = 1
