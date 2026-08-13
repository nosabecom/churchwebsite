import {createHash} from 'node:crypto'
import {readFile, readdir, stat} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {markdownToPortableText} from '@portabletext/markdown'
import matter from 'gray-matter'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')

export const sources = [
  {site: 'churchMain', directory: 'apps/churchmain/src/content/newsletters'},
  {site: 'womanExcel', directory: 'apps/womanexcel/src/content/newsletters'},
]

const digest = (algorithm, value) => createHash(algorithm).update(value).digest('hex')
const posix = (value) => value.split(path.sep).join('/')

export function seededKeyGenerator(seed) {
  let index = 0
  return () => digest('sha256', `${seed}:${index++}`).slice(0, 12)
}

export async function extractNewsletters(root = repoRoot) {
  const records = []
  for (const source of sources) {
    const absoluteDirectory = path.join(root, source.directory)
    const filenames = (await readdir(absoluteDirectory))
      .filter((filename) => /\.mdx?$/.test(filename))
      .sort()

    for (const filename of filenames) {
      const absolutePath = path.join(absoluteDirectory, filename)
      const sourcePath = posix(path.relative(root, absolutePath))
      const raw = (await readFile(absolutePath, 'utf8')).replace(/\r\n/g, '\n')
      const parsed = matter(raw)
      const slug = filename.replace(/\.mdx?$/, '')
      records.push({
        site: source.site,
        slug,
        sourceKey: `newsletter:${source.site}:${slug}`,
        sourcePath,
        sourceHash: digest('sha256', raw),
        frontmatter: parsed.data,
        markdown: parsed.content.trim(),
      })
    }
  }
  return records
}

function normalizedDate(value, sourcePath) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) throw new Error(`${sourcePath}: invalid publishedAt`)
  return date.toISOString().slice(0, 10)
}

export function transformNewsletter(record) {
  const {frontmatter} = record
  const body = markdownToPortableText(record.markdown, {
    keyGenerator: seededKeyGenerator(record.sourceKey),
    html: {inline: 'text'},
  })
  const coverSourcePath = frontmatter.image
    ? posix(
        path.join(
          `apps/${record.site === 'womanExcel' ? 'womanexcel' : 'churchmain'}/public`,
          frontmatter.image,
        ),
      )
    : undefined

  return {
    _type: 'newsletterIssue',
    site: record.site,
    title: frontmatter.title,
    slug: {_type: 'slug', current: record.slug},
    publishedAt: normalizedDate(frontmatter.publishedAt, record.sourcePath),
    ...(frontmatter.issue === undefined ? {} : {issue: frontmatter.issue}),
    excerpt: frontmatter.excerpt,
    ...(coverSourcePath
      ? {
          coverImage: {
            _type: 'editorialImage',
            assetSourcePath: coverSourcePath,
            alt: frontmatter.imageAlt ?? '',
            decorative: !frontmatter.imageAlt,
          },
        }
      : {}),
    ...(frontmatter.link
      ? {relatedLink: {_type: 'link', label: 'Related link', href: frontmatter.link}}
      : {}),
    seo: {
      _type: 'seo',
      title: frontmatter.title,
      description: frontmatter.excerpt,
    },
    body,
    migrationMetadata: {
      _type: 'migrationMetadata',
      sourceKey: record.sourceKey,
      sourcePath: record.sourcePath,
      sourceHash: record.sourceHash,
    },
    migrationState: frontmatter.draft === true ? 'draft' : 'published',
  }
}

export async function transformAll(root = repoRoot) {
  return (await extractNewsletters(root)).map(transformNewsletter)
}

export async function assetDetails(document, root = repoRoot) {
  const sourcePath = document.coverImage?.assetSourcePath
  if (!sourcePath) return undefined
  const absolutePath = path.resolve(root, sourcePath)
  if (!absolutePath.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error(`${document.migrationMetadata.sourcePath}: cover escapes repository`)
  }
  const info = await stat(absolutePath)
  if (!info.isFile()) throw new Error(`${sourcePath}: cover is not a file`)
  const bytes = await readFile(absolutePath)
  return {
    absolutePath,
    sourcePath,
    size: info.size,
    sha1: digest('sha1', bytes),
  }
}

export async function validateDocuments(documents, root = repoRoot) {
  const errors = []
  const warnings = []
  const pairs = new Set()
  const assets = []
  for (const document of documents) {
    const label = document.migrationMetadata?.sourcePath ?? 'unknown source'
    for (const field of ['site', 'title', 'publishedAt', 'excerpt', 'body'])
      if (!document[field] || (Array.isArray(document[field]) && document[field].length === 0))
        errors.push(`${label}: missing ${field}`)
    if (!['churchMain', 'womanExcel'].includes(document.site)) errors.push(`${label}: invalid site`)
    if (
      !document.migrationMetadata?.sourceKey ||
      !document.migrationMetadata?.sourcePath ||
      !/^[a-f0-9]{64}$/.test(document.migrationMetadata?.sourceHash ?? '')
    )
      errors.push(`${label}: incomplete migration metadata`)
    if (!['draft', 'published'].includes(document.migrationState))
      errors.push(`${label}: invalid migration state`)
    if (!/^\d{4}-\d{2}$/.test(document.slug?.current ?? '')) errors.push(`${label}: invalid slug`)
    const pair = `${document.site}:${document.slug?.current}`
    if (pairs.has(pair)) errors.push(`${label}: duplicate site/slug ${pair}`)
    pairs.add(pair)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(document.publishedAt) ||
      Number.isNaN(Date.parse(document.publishedAt))
    )
      errors.push(`${label}: invalid date`)
    if (document.issue !== undefined && (!Number.isInteger(document.issue) || document.issue <= 0))
      errors.push(`${label}: issue must be a positive integer`)
    if (!document.seo?.title || !document.seo?.description) errors.push(`${label}: incomplete SEO`)
    if (!Array.isArray(document.body) || document.body.some((block) => block._type !== 'block'))
      errors.push(`${label}: body contains unsupported Portable Text objects`)
    const keys = new Set()
    for (const block of document.body ?? []) {
      if (!['normal', 'h2', 'h3', 'blockquote'].includes(block.style ?? 'normal'))
        errors.push(`${label}: unsupported Portable Text style ${block.style}`)
      if (block.listItem && !['bullet', 'number'].includes(block.listItem))
        errors.push(`${label}: unsupported Portable Text list ${block.listItem}`)
      for (const item of [block, ...(block.children ?? []), ...(block.markDefs ?? [])]) {
        if (!item._key) errors.push(`${label}: Portable Text item is missing a key`)
        else if (keys.has(item._key))
          errors.push(`${label}: duplicate Portable Text key ${item._key}`)
        else keys.add(item._key)
      }
      for (const span of block.children ?? []) {
        for (const mark of span.marks ?? []) {
          const decorator = ['strong', 'em'].includes(mark)
          const annotation = (block.markDefs ?? []).some((markDef) => markDef._key === mark)
          if (!decorator && !annotation)
            errors.push(`${label}: unsupported Portable Text mark ${mark}`)
        }
      }
      for (const markDef of block.markDefs ?? []) {
        if (markDef._type !== 'link' || !/^(\/(?!\/)|https?:\/\/|mailto:)/.test(markDef.href ?? ''))
          errors.push(`${label}: invalid Portable Text link`)
      }
    }
    if (document.relatedLink && !/^(\/(?!\/)|https?:\/\/|mailto:)/.test(document.relatedLink.href))
      errors.push(`${label}: invalid related link`)
    try {
      const asset = await assetDetails(document, root)
      if (asset) {
        const {absolutePath: _absolutePath, ...reproducibleAsset} = asset
        assets.push(reproducibleAsset)
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
    if (document.coverImage && !document.coverImage.decorative && !document.coverImage.alt)
      errors.push(`${label}: non-decorative cover needs alt text`)
    if (
      /placeholder copy/i.test(
        document.body
          .flatMap((block) => block.children ?? [])
          .map((span) => span.text ?? '')
          .join(' '),
      )
    )
      warnings.push(`${label}: placeholder editorial copy`)
  }
  const bySite = Object.fromEntries(
    sources.map(({site}) => [site, documents.filter((d) => d.site === site).length]),
  )
  if (documents.length !== 8) errors.push(`expected 8 documents, found ${documents.length}`)
  if (bySite.churchMain !== 4 || bySite.womanExcel !== 4)
    errors.push(`expected 4 documents per site, found ${JSON.stringify(bySite)}`)
  return {
    ok: errors.length === 0,
    counts: {total: documents.length, bySite, assets: assets.length},
    assets,
    errors,
    warnings,
  }
}

export function importableDocument(document, assetId) {
  const {migrationState, ...result} = structuredClone(document)
  if (result.coverImage) {
    if (!assetId)
      throw new Error(`${result.migrationMetadata.sourcePath}: missing uploaded asset ID`)
    delete result.coverImage.assetSourcePath
    result.coverImage.asset = {_type: 'reference', _ref: assetId}
  }
  return {document: result, migrationState}
}
