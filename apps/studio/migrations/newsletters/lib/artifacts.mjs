import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'

export async function writeJson(filename, value) {
  await mkdir(path.dirname(filename), {recursive: true})
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`)
}
