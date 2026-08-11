import {createHash} from 'node:crypto'
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '../../..')
const configPath = path.join(repositoryRoot, 'migration/media/inventory.config.json')
const reportDirectory = path.join(repositoryRoot, 'migration/media/reports')
const manifestPath = path.join(reportDirectory, 'media-manifest.csv')
const summaryPath = path.join(reportDirectory, 'media-summary.md')

const config = JSON.parse(await readFile(configPath, 'utf8'))
const allowedExtensions = new Set(config.assetExtensions.map((extension) => extension.toLowerCase()))

function expandConfiguredAssets() {
  const assets = {...config.assets}

  for (const group of config.assetGroups ?? []) {
    for (const item of group.items) {
      const sourcePath = `${group.pathPrefix}${item.filename}`
      if (assets[sourcePath]) throw new Error(`Duplicate inventory configuration for ${sourcePath}`)
      assets[sourcePath] = {...group.defaults, ...item}
      delete assets[sourcePath].filename
    }
  }

  return assets
}

const configuredAssets = expandConfiguredAssets()

async function walk(directory) {
  const entries = await readdir(directory, {withFileTypes: true})
  const files = []

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.astro') continue
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(absolutePath)))
    if (entry.isFile()) files.push(absolutePath)
  }

  return files
}

function normalizePath(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join('/')
}

function jpegDimensions(buffer) {
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const standalone = marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)
    if (standalone) {
      offset += 2
      continue
    }

    const length = buffer.readUInt16BE(offset + 2)
    const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)
    if (isStartOfFrame) {
      return {width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5)}
    }
    if (length < 2) break
    offset += length + 2
  }
  return null
}

function svgDimensions(buffer) {
  const openingTag = buffer.toString('utf8', 0, Math.min(buffer.length, 128 * 1024)).match(/<svg\b[^>]*>/i)?.[0]
  if (!openingTag) return null

  const width = openingTag.match(/\bwidth=["']([\d.]+)(?:px)?["']/i)?.[1]
  const height = openingTag.match(/\bheight=["']([\d.]+)(?:px)?["']/i)?.[1]
  if (width && height) return {width: Number(width), height: Number(height)}

  const viewBox = openingTag.match(/\bviewBox=["'][\d.-]+[ ,]+[\d.-]+[ ,]+([\d.]+)[ ,]+([\d.]+)["']/i)
  return viewBox ? {width: Number(viewBox[1]), height: Number(viewBox[2])} : null
}

function dimensionsFor(buffer, extension) {
  if (extension === '.png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)}
  }
  if (extension === '.jpg' || extension === '.jpeg') return jpegDimensions(buffer)
  if (extension === '.svg') return svgDimensions(buffer)
  return null
}

function csv(value) {
  if (value === null || value === undefined) return ''
  const text = Array.isArray(value) ? value.join('; ') : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function countBy(records, property) {
  return records.reduce((counts, record) => {
    const key = record[property]
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}

function markdownCounts(counts) {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `| ${name} | ${count} |`)
    .join('\n')
}

const scannedFiles = (
  await Promise.all(config.scanRoots.map((root) => walk(path.join(repositoryRoot, root))))
)
  .flat()
  .filter((file) => allowedExtensions.has(path.extname(file).toLowerCase()))
  .sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)))

const scannedPaths = scannedFiles.map(normalizePath)
const configuredPaths = Object.keys(configuredAssets).sort()
const unclassified = scannedPaths.filter((file) => !configuredAssets[file])
const missing = configuredPaths.filter((file) => !scannedPaths.includes(file))
const requiredProperties = [
  'site',
  'classification',
  'disposition',
  'destination',
  'owner',
  'usageFiles',
  'altText',
  'altTextStatus',
  'caption',
  'credit',
  'usageApproval',
  'originalStatus',
  'qualityIssues',
  'notes',
]
const classifications = new Set([
  'editorial image',
  'repository/build asset',
  'logo/brand asset',
  'document',
  'video',
])
const dispositions = new Set(['keep in Git', 'move to Sanity', 'move to YouTube', 'replace', 'remove'])
const configurationErrors = []

for (const [sourcePath, metadata] of Object.entries(configuredAssets)) {
  for (const property of requiredProperties) {
    if (!Object.hasOwn(metadata, property)) configurationErrors.push(`${sourcePath}: missing ${property}`)
  }
  if (!classifications.has(metadata.classification)) {
    configurationErrors.push(`${sourcePath}: invalid classification ${metadata.classification}`)
  }
  if (!dispositions.has(metadata.disposition)) {
    configurationErrors.push(`${sourcePath}: invalid disposition ${metadata.disposition}`)
  }
  if (!Array.isArray(metadata.usageFiles) || !Array.isArray(metadata.qualityIssues)) {
    configurationErrors.push(`${sourcePath}: usageFiles and qualityIssues must be arrays`)
  }
  if (metadata.possibleDuplicateOf && !configuredAssets[metadata.possibleDuplicateOf]) {
    configurationErrors.push(`${sourcePath}: possibleDuplicateOf is not an inventoried asset`)
  }
  for (const usageFile of metadata.usageFiles ?? []) {
    try {
      const usageStat = await stat(path.join(repositoryRoot, usageFile))
      if (!usageStat.isFile()) configurationErrors.push(`${sourcePath}: usage path is not a file: ${usageFile}`)
    } catch {
      configurationErrors.push(`${sourcePath}: usage file is missing: ${usageFile}`)
    }
  }
}

if (unclassified.length || missing.length || configurationErrors.length) {
  const messages = []
  if (unclassified.length) messages.push(`Unclassified assets:\n- ${unclassified.join('\n- ')}`)
  if (missing.length) messages.push(`Configured assets missing from disk:\n- ${missing.join('\n- ')}`)
  if (configurationErrors.length) messages.push(`Invalid inventory metadata:\n- ${configurationErrors.join('\n- ')}`)
  throw new Error(messages.join('\n\n'))
}

const records = []
for (const absolutePath of scannedFiles) {
  const sourcePath = normalizePath(absolutePath)
  const buffer = await readFile(absolutePath)
  const metadata = configuredAssets[sourcePath]
  const fileStat = await stat(absolutePath)
  const extension = path.extname(sourcePath).toLowerCase()
  const dimensions = dimensionsFor(buffer, extension)

  records.push({
    sourcePath,
    ...metadata,
    fileType: extension.slice(1),
    bytes: fileStat.size,
    dimensions: dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown',
    sha256: createHash('sha256').update(buffer).digest('hex'),
  })
}

const hashOwners = new Map()
for (const record of records) {
  const firstPath = hashOwners.get(record.sha256)
  record.exactDuplicateOf = firstPath ?? null
  if (!firstPath) hashOwners.set(record.sha256, record.sourcePath)
}

const columns = [
  ['source_path', 'sourcePath'],
  ['site', 'site'],
  ['classification', 'classification'],
  ['file_type', 'fileType'],
  ['bytes', 'bytes'],
  ['dimensions', 'dimensions'],
  ['sha256', 'sha256'],
  ['disposition', 'disposition'],
  ['destination', 'destination'],
  ['owner', 'owner'],
  ['usage_files', 'usageFiles'],
  ['alt_text', 'altText'],
  ['alt_text_status', 'altTextStatus'],
  ['caption', 'caption'],
  ['credit', 'credit'],
  ['usage_approval', 'usageApproval'],
  ['original_status', 'originalStatus'],
  ['exact_duplicate_of', 'exactDuplicateOf'],
  ['possible_duplicate_of', 'possibleDuplicateOf'],
  ['quality_issues', 'qualityIssues'],
  ['notes', 'notes'],
]

const manifest = [
  columns.map(([heading]) => csv(heading)).join(','),
  ...records.map((record) => columns.map(([, property]) => csv(record[property])).join(',')),
].join('\n')

const exactDuplicates = records.filter((record) => record.exactDuplicateOf)
const placeholders = records.filter((record) => record.qualityIssues.includes('placeholder'))
const missingAlt = records.filter((record) => record.altTextStatus === 'missing')
const unknownApproval = records.filter((record) => record.usageApproval === 'unconfirmed')
const missingOriginals = records.filter((record) => /missing|unconfirmed/i.test(record.originalStatus))
const oversized = records.filter((record) => record.qualityIssues.some((issue) => /oversized|unusually large|large raster/i.test(issue)))

const summary = `# Media inventory summary

Generated by \`pnpm audit:media\` from \`migration/media/inventory.config.json\`.

## Scope and assumptions

- Repository roots scanned: ${config.scanRoots.map((root) => `\`${root}\``).join(', ')}.
- No approved external source folders were provided, so they are not included yet.
- No video files are present in scope. Production sermon or event videos belong on YouTube; Sanity should store their metadata/IDs rather than ordinary uploaded video files.
- All eleven stock images are development-only placeholders, are marked \`replace\`, and must not be uploaded to Sanity.
- The live 2025 and 2026 Woman Excel conference pages use real, supplied event imagery. Ten development-only stock files remain referenced by the public conference template, fellowship homepage, or newsletters and must be replaced before production use.
- The approved 2025 and 2026 hero theme artworks are conference-specific editorial assets mapped to each conference document's \`themeArtwork\` image field in Sanity; they are not logos or global build assets.

## Counts

| Measure | Count |
| --- | ---: |
| Assets | ${records.length} |
| Exact byte duplicates | ${exactDuplicates.length} |
| Placeholders | ${placeholders.length} |
| Missing alt text | ${missingAlt.length} |
| Usage approval unconfirmed | ${unknownApproval.length} |
| Missing/unconfirmed originals | ${missingOriginals.length} |
| Oversized or unusually large | ${oversized.length} |

### By site

| Site | Count |
| --- | ---: |
${markdownCounts(countBy(records, 'site'))}

### By classification

| Classification | Count |
| --- | ---: |
${markdownCounts(countBy(records, 'classification'))}

### By disposition

| Disposition | Count |
| --- | ---: |
${markdownCounts(countBy(records, 'disposition'))}

## Actionable findings

1. Replace all ten development-only \`apps/womanexcel/public/images/placeholds/photo-*.jpg\` files or retire their remaining usages. They are no longer used by the live 2025/2026 conference pages, but the public \`/conference/template\` route, fellowship homepage, and three newsletters still reference them.
2. Do not migrate \`apps/churchmain/public/images/placeholds/1.jpg\`; keep it only as a development placeholder until Church Main originals are supplied for RCC-50.
3. The eight Woman Excel 2026 speaker/performer cutouts are approved for use, but their credits remain unconfirmed. Confirm permission and credit for the remaining editorial assets, including the 48 new Woman Excel 2025/2026 gallery photographs and the conference posters/programmes.
4. Obtain the missing camera originals where possible. The repository contains web-ready gallery JPEGs, derived transparent cutouts/crops, and flattened poster/programme files rather than source originals.
5. Replace all three currently approved Woman Excel conference-logo variants (\`logo-full.png\`, \`logo.png\`, and \`logo.svg\`) with their white versions when supplied.
6. Optimize the eight 1000x1000, 16-bit speaker PNGs (each currently over 2 MB), the 1.2 MB conference logo SVG, and the large Church Main raster logo before production delivery.
7. Add accessible text for the 2026 poster. The current \`alt=""\` hides it from assistive technology even though important event details are embedded in the image.
8. Replace the two Church Main pastor crops with the newer approved Woman Excel portraits, which are the selected canonical Sanity candidates for both sites; their credits still need to be recorded.
9. Keep the accessible HTML 2025 schedule when migrating its two programme images because the image text alone is not an accessible content source.

## Downstream migration contract

- RCC-33 should upload only records whose disposition is \`move to Sanity\` after approval and quality issues are resolved; placeholder records are replacement requirements, not upload inputs.
- RCC-50 should follow the same rule and wait for approved Church Main originals instead of uploading the current stock hero image.
- Logo/brand records remain in the Git/replacement workflow; the three current Woman Excel conference-logo variants are temporary and must be replaced with white versions.
- Approved conference hero theme artworks move to the owning Sanity conference document's \`themeArtwork\` image field so each year retains its own artwork.
- Future production video records should resolve to YouTube IDs/URLs, not Sanity file assets.
- Reruns fail if a new media file lacks an explicit classification/disposition or if a configured source path disappears, keeping the manifest complete.

## Validation and cutover

- Re-run \`pnpm audit:media\` whenever source media changes and review the CSV diff.
- Before import, resolve every \`usage_approval=unconfirmed\`, missing original, credit, and required alt-text item.
- After import, compare uploaded counts by owner and spot-check Church Main hero/pastor and Woman Excel conference hero/speaker rendering.
- At cutover, crawl both sites for broken media URLs and verify the Woman Excel conference contains no placeholder paths.
`

await mkdir(reportDirectory, {recursive: true})
await writeFile(manifestPath, `${manifest}\n`)
await writeFile(summaryPath, summary)

console.log(`Audited ${records.length} media assets.`)
console.log(`Wrote ${normalizePath(manifestPath)}`)
console.log(`Wrote ${normalizePath(summaryPath)}`)
