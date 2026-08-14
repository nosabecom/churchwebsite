import {createReadStream} from 'node:fs'

import {assetDetails, importableDocument, transformAll, validateDocuments} from './core.mjs'

export const SANITY_API_VERSION = '2026-08-13'

const allowedDataset = /^(?:dev|development|review|staging|test)(?:-[a-z0-9]+)*$/i
const productionSegment = /(?:^|-)prod(?:uction)?(?:-|$)/i

export function assertSafeDataset(dataset, confirmedDataset) {
  if (
    !dataset ||
    confirmedDataset !== dataset ||
    !allowedDataset.test(dataset) ||
    productionSegment.test(dataset)
  ) {
    throw new Error(
      'Refusing to write: use a dev/development/review/staging/test dataset and pass its exact name with --confirm-review-dataset',
    )
  }
}

export async function resolveAssetId(client, document) {
  const asset = await assetDetails(document)
  if (!asset) return undefined
  const existing = await client.fetch(
    `*[_type == "sanity.imageAsset" && sha1hash == $sha1][0]._id`,
    {sha1: asset.sha1},
  )
  if (existing) return existing
  const uploaded = await client.assets.upload('image', createReadStream(asset.absolutePath), {
    filename: asset.sourcePath.split('/').at(-1),
  })
  return uploaded._id
}

export async function upsertNewsletter(client, document, resolveAsset = resolveAssetId) {
  const sourceKey = document.migrationMetadata.sourceKey
  const existingId = await client.fetch(
    `*[_type == "newsletterIssue" && migrationMetadata.sourceKey == $sourceKey][0]._id`,
    {sourceKey},
  )
  const assetId = await resolveAsset(client, document)
  const prepared = importableDocument(document, assetId)

  let baseId = existingId?.replace(/^drafts\./, '')
  let createdNew = false
  if (!baseId) {
    const created = await client.create(prepared.document, {visibility: 'deferred'})
    baseId = created._id
    createdNew = true
  }

  const publishedId = baseId
  const draftId = `drafts.${baseId}`
  const targetId = prepared.migrationState === 'draft' ? draftId : publishedId
  const staleId = prepared.migrationState === 'draft' ? publishedId : draftId
  const transaction = client.transaction().createOrReplace({...prepared.document, _id: targetId})
  const staleExists =
    (createdNew && staleId === publishedId) ||
    (await client.fetch(`defined(*[_id == $id][0]._id)`, {id: staleId}))
  if (staleExists) transaction.delete(staleId)
  await transaction.commit({visibility: 'sync'})
  return {sourceKey, id: targetId, state: prepared.migrationState}
}

export async function runNewsletterImport(client, dataset, documents) {
  documents ??= await transformAll()
  const validation = await validateDocuments(documents)
  if (!validation.ok)
    throw new Error(`Migration validation failed:\n${validation.errors.join('\n')}`)

  const results = []
  for (const document of documents) results.push(await upsertNewsletter(client, document))

  const sourceKeys = documents.map((document) => document.migrationMetadata.sourceKey)
  const importedDocuments = await client.fetch(
    `*[_type == "newsletterIssue" && migrationMetadata.sourceKey in $sourceKeys]{
      _id, site, "slug": slug.current, "sourceKey": migrationMetadata.sourceKey,
      "assetId": coverImage.asset->_id
    }`,
    {sourceKeys},
  )
  const importedSourceKeys = new Set(importedDocuments.map((document) => document.sourceKey))
  const pairs = importedDocuments.map((document) => `${document.site}:${document.slug}`)
  const duplicates = pairs.filter((pair, index) => pairs.indexOf(pair) !== index)
  const missingSourceKeys = sourceKeys.filter((sourceKey) => !importedSourceKeys.has(sourceKey))
  const unexpectedSourceKeys = [...importedSourceKeys].filter(
    (sourceKey) => !sourceKeys.includes(sourceKey),
  )
  const missingAssetReferences = importedDocuments.filter(
    (document) =>
      documents.find((source) => source.migrationMetadata.sourceKey === document.sourceKey)
        ?.coverImage && !document.assetId,
  )
  if (
    importedDocuments.length !== documents.length ||
    duplicates.length ||
    missingSourceKeys.length ||
    unexpectedSourceKeys.length ||
    missingAssetReferences.length
  ) {
    throw new Error(
      `Post-import validation failed: ${JSON.stringify({importedDocuments, duplicates, missingSourceKeys, unexpectedSourceKeys, missingAssetReferences})}`,
    )
  }
  const counts = Object.fromEntries(
    ['churchMain', 'womanExcel'].map((site) => [
      site,
      importedDocuments.filter((document) => document.site === site).length,
    ]),
  )
  return {dataset, imported: results.length, counts, results}
}
