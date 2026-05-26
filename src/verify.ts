import { decompressSync, type SkinData } from '@sonolus/core'
import fs from 'fs-extra'
import path from 'node:path'
import sharp from 'sharp'

export async function verifyOutput(outputRoot: string, expectedCount?: number): Promise<void> {
    const skinsRoot = path.join(outputRoot, 'skins')
    const dirs = (await fs.readdir(skinsRoot)).sort()
    if (expectedCount !== undefined && dirs.length !== expectedCount) {
        throw new Error(`${skinsRoot}: expected ${expectedCount} skin pack(s), found ${dirs.length}`)
    }

    for (const dir of dirs) {
        const dataPath = path.join(skinsRoot, dir, 'data')
        const texturePath = path.join(skinsRoot, dir, 'texture.png')
        const itemPath = path.join(skinsRoot, dir, 'item.json')
        const thumbnailPath = path.join(skinsRoot, dir, 'thumbnail.png')
        for (const filePath of [itemPath, dataPath, texturePath, thumbnailPath]) {
            if (!(await fs.pathExists(filePath))) {
                throw new Error(`${dir}: missing ${path.basename(filePath)}`)
            }
        }

        const data = decompressSync<SkinData>(await fs.readFile(dataPath))
        const texture = await sharp(texturePath).metadata()
        if (data.width !== texture.width || data.height !== texture.height) {
            throw new Error(`${dir}: data size ${data.width}x${data.height} does not match texture ${texture.width}x${texture.height}`)
        }

        const currentNames = data.sprites.map((sprite) => sprite.name).sort()
        const judge = currentNames.find((name) => name.toLowerCase().includes('judge'))
        if (judge) throw new Error(`${dir}: unexpected judge sprite ${judge}`)

        const invalid = currentNames.find(
            (name) => name.startsWith('#') || name.startsWith('bandori:rhythm:') || name.startsWith('bandori:directional:') || name.startsWith('bandori:field:'),
        )
        if (invalid) throw new Error(`${dir}: invalid sprite name ${invalid}`)
    }
}
