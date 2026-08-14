import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'

export async function writeJson(filename, value) {
  await mkdir(path.dirname(filename), {recursive: true})
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`)
}

const namedEntities = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: '\u00a0',
  quot: '"',
}

export function decodeHtmlEntities(value) {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code) => {
    if (code[0] !== '#') return namedEntities[code.toLowerCase()]
    const hexadecimal = code[1].toLowerCase() === 'x'
    const point = Number.parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10)
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : entity
  })
}

export function normalizeRenderedText(value) {
  return decodeHtmlEntities(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/--|[–—]/g, '-')
    .replace(/\.\.\.|…/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
}

export function renderedHrefs(html) {
  return [...html.matchAll(/\bhref=(['"])(.*?)\1/gi)].map((match) => decodeHtmlEntities(match[2]))
}
