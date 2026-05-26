import { customName, laneKeys } from '../constants.js'
import { fetchImageAsset, fetchManifest, fetchText, requireManifestFile } from '../bestdori.js'
import { rotate } from '../image.js'
import { extractNamedSprites, parseBundle, parseSprites } from '../unity.js'
import { scale } from '../transform.js'
import type { ImageAsset, Server, SpriteAsset } from '../types.js'

export type DirectionalResources = {
    id: string
    server: Server
    sprites: Map<string, ImageAsset>
    lineLeft: ImageAsset
    lineRight: ImageAsset
}

export async function getDirectionalResources(id: string, server: Server): Promise<DirectionalResources> {
    const manifest = await fetchManifest('noteskin', server, id)
    const spritesFile = requireManifestFile(manifest, '.sprites')
    const bundleFile = requireManifestFile(manifest, `ingameskin-noteskin-${id}.bundle`)
    const atlasFiles = manifest.filter((file) => file.toLowerCase().endsWith('.png') && !file.toLowerCase().startsWith('flicknoteline_'))

    const [spritesRaw, bundleRaw, atlasImages, lineLeft, lineRight] = await Promise.all([
        fetchText('noteskin', server, id, spritesFile),
        fetchText('noteskin', server, id, bundleFile),
        Promise.all(atlasFiles.map(async (file) => [file.toLowerCase(), await fetchImageAsset('noteskin', server, id, file)] as const)),
        fetchImageAsset('noteskin', server, id, requireManifestFile(manifest, 'FlickNoteLine_l.png')),
        fetchImageAsset('noteskin', server, id, requireManifestFile(manifest, 'FlickNoteLine_r.png')),
    ])

    return {
        id,
        server,
        sprites: await extractNamedSprites({
            sprites: parseSprites(spritesRaw),
            bundle: parseBundle(bundleRaw),
            imagesByFile: new Map(atlasImages),
        }),
        lineLeft,
        lineRight,
    }
}

export async function buildDirectionalSprites(resources: DirectionalResources): Promise<SpriteAsset[]> {
    const noteTransform = scale(1.3, 1.2)
    const markerTransform = scale(0.75, 0.75)
    const unitTransform = scale(1, 1)
    const noteLeft = imageFor(resources, 'note_flick_l_3')
    const noteRight = imageFor(resources, 'note_flick_r_3')
    const markerLeft = await rotate(imageFor(resources, 'note_flick_top_l'), 90)
    const markerRight = await rotate(imageFor(resources, 'note_flick_top_r'), -90)

    const output: SpriteAsset[] = [
        { names: [customName.directional('note_flick_l')], image: noteLeft, transform: noteTransform },
        { names: [customName.directional('note_flick_r')], image: noteRight, transform: noteTransform },
        { names: [customName.directional('note_flick_top_l')], image: markerLeft, transform: markerTransform },
        { names: [customName.directional('note_flick_top_r')], image: markerRight, transform: markerTransform },
        { names: [customName.directional('FlickNoteLine_l')], image: resources.lineLeft, transform: unitTransform },
        { names: [customName.directional('FlickNoteLine_r')], image: resources.lineRight, transform: unitTransform },
    ]

    for (const prefix of ['note_flick_l', 'note_flick_r']) {
        for (const key of laneKeys) {
            output.push({ names: [customName.directional(`${prefix}_${key}`)], image: imageFor(resources, `${prefix}_${key}`, `${prefix}_3`), transform: noteTransform })
        }
    }

    return output
}

function imageFor(resources: DirectionalResources, name: string, fallbackName?: string): ImageAsset {
    const found = resources.sprites.get(name)
    if (found) return found
    if (fallbackName) {
        const fallback = resources.sprites.get(fallbackName)
        if (fallback) return fallback
    }
    throw new Error(`${resources.id} missing sprite: ${name}`)
}
