import {createReadStream} from 'node:fs'

import {createClient} from '@sanity/client'

import {assetDetails, importableDocument, transformAll, validateDocuments} from '../lib/core.mjs'

const confirmationIndex = process.argv.indexOf('--confirm-review-dataset')
const confirmedDataset = confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : undefined
const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET
const token = process.env.SANITY_AUTH_TOKEN

if (!projectId || !dataset || !token) {
  throw new Error(
    'SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET, and SANITY_AUTH_TOKEN are required',
  )
}
if (!confirmedDataset || confirmedDataset !== dataset || !/(review|staging|test)/i.test(dataset)) {
  throw new Error(
    'Refusing to write: pass --confirm-review-dataset <dataset>, matching a review/staging/test dataset',
  )
}
if (/^(production|prod)$/i.test(dataset))
  throw new Error('Production imports are intentionally unsupported')

const documents = await transformAll()
const validation = await validateDocuments(documents)
if (!validation.ok) throw new Error(`Migration validation failed:\n${validation.errors.join('\n')}`)

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2026-08-13',
  useCdn: false,
  perspective: 'raw',
})

async function resolveAssetId(document) {
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

async function upsert(document) {
  const sourceKey = document.migrationMetadata.sourceKey
  const existingId = await client.fetch(
    `*[_type == "newsletterIssue" && migrationMetadata.sourceKey == $sourceKey][0]._id`,
    {sourceKey},
  )
  const assetId = await resolveAssetId(document)
  const prepared = importableDocument(document, assetId)

  let baseId = existingId?.replace(/^drafts\./, '')
  if (!baseId) {
    const created = await client.create(
      {_type: 'newsletterIssue', migrationMetadata: prepared.document.migrationMetadata},
      {visibility: 'sync'},
    )
    baseId = created._id
  }

  const publishedId = baseId
  const draftId = `drafts.${baseId}`
  const targetId = prepared.migrationState === 'draft' ? draftId : publishedId
  const staleId = prepared.migrationState === 'draft' ? publishedId : draftId
  const transaction = client.transaction().createOrReplace({...prepared.document, _id: targetId})
  const staleExists = await client.fetch(`defined(*[_id == $id][0]._id)`, {id: staleId})
  if (staleExists) transaction.delete(staleId)
  await transaction.commit({visibility: 'sync'})
  return {sourceKey, id: targetId, state: prepared.migrationState}
}

const results = []
for (const document of documents) results.push(await upsert(document))

const sourceKeys = documents.map((document) => document.migrationMetadata.sourceKey)
const importedDocuments = await client.fetch(
  `*[_type == "newsletterIssue" && migrationMetadata.sourceKey in $sourceKeys]{
    _id, site, "slug": slug.current, "sourceKey": migrationMetadata.sourceKey,
    "assetId": coverImage.asset->_id
  }`,
  {sourceKeys},
)
const pairs = importedDocuments.map((document) => `${document.site}:${document.slug}`)
const duplicates = pairs.filter((pair, index) => pairs.indexOf(pair) !== index)
const missingAssetReferences = importedDocuments.filter(
  (document) =>
    documents.find((source) => source.migrationMetadata.sourceKey === document.sourceKey)
      ?.coverImage && !document.assetId,
)
if (
  importedDocuments.length !== documents.length ||
  duplicates.length ||
  missingAssetReferences.length
) {
  throw new Error(
    `Post-import validation failed: ${JSON.stringify({importedDocuments, duplicates, missingAssetReferences})}`,
  )
}
const counts = Object.fromEntries(
  ['churchMain', 'womanExcel'].map((site) => [
    site,
    importedDocuments.filter((document) => document.site === site).length,
  ]),
)
console.log(JSON.stringify({dataset, imported: results.length, counts, results}, null, 2))
