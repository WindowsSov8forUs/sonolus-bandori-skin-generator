import { customName, habahiroFlickTopKeys, habahiroNoteKeys, habahiroWidthKeys } from '../constants.js'
import { fetchImageAsset, fetchManifest, fetchText, requireManifestFile } from '../bestdori.js'
import { parseBundle, parseSprites, extractNamedSprites } from '../unity.js'
import { scale } from '../transform.js'
import type { ImageAsset, Server, SpriteAsset } from '../types.js'

export type NoteSkinResources = {
    id: string
    server: Server
    isHabahiro: boolean
    sprites: Map<string, ImageAsset>
    longLine: ImageAsset
    longLineSpecial: ImageAsset
    simLine: ImageAsset
}

export async function getNoteSkinResources(id: string, server: Server, isHabahiro: boolean): Promise<NoteSkinResources> {
    const manifest = await fetchManifest('noteskin', server, id)
    const spritesFile = requireManifestFile(manifest, '.sprites')
    const bundleFile = requireManifestFile(manifest, `ingameskin-noteskin-${id}.bundle`)
    const atlasFiles = manifest.filter((file) => file.toLowerCase().endsWith('.png'))

    const longLineFile = requireManifestFile(manifest, 'longNoteLine.png')
    const longLineSpecialFile = optionalManifestFile(manifest, 'longNoteLine2.png') ?? longLineFile

    const [spritesRaw, bundleRaw, atlasImages, longLine, longLineSpecial, simLine] = await Promise.all([
        fetchText('noteskin', server, id, spritesFile),
        fetchText('noteskin', server, id, bundleFile),
        Promise.all(atlasFiles.map(async (file) => [file.toLowerCase(), await fetchImageAsset('noteskin', server, id, file)] as const)),
        fetchImageAsset('noteskin', server, id, longLineFile),
        fetchImageAsset('noteskin', server, id, longLineSpecialFile),
        fetchImageAsset('noteskin', server, id, requireManifestFile(manifest, 'simultaneous_line.png')),
    ])

    return {
        id,
        server,
        isHabahiro,
        sprites: await extractNamedSprites({
            sprites: parseSprites(spritesRaw),
            bundle: parseBundle(bundleRaw),
            imagesByFile: new Map(atlasImages),
        }),
        longLine,
        longLineSpecial,
        simLine,
    }
}

function optionalManifestFile(files: readonly string[], fileName: string): string | undefined {
    const normalized = fileName.toLowerCase()
    return files.find((file) => file.toLowerCase() === normalized)
}

export function buildNoteSkinSprites(resources: NoteSkinResources): SpriteAsset[] {
    const noteTransform = scale(1.3, 1.2)
    const unitTransform = scale(1, 1)
    const markerTransform = scale(0.75, 0.75)
    const simLineTransform = scale(1, 0.5)

    const output: SpriteAsset[] = []

    const noteKeys = resources.isHabahiro ? habahiroNoteKeys : ['0', '1', '2', '3', '4', '5', '6']
    for (const prefix of ['note_normal', 'note_normal_16', 'note_skill', 'note_flick', 'note_long', 'note_long_flash']) {
        for (const key of noteKeys) {
            output.push({ names: [customName.rhythm(`${prefix}_${key}`)], image: imageFor(resources, `${prefix}_${key}`, `${prefix}_3`), transform: noteTransform })
        }
    }

    for (const key of resources.isHabahiro ? habahiroFlickTopKeys : ['1']) {
        const sourceName = key === '1' ? 'note_flick_top' : `note_flick_top_${key}`
        output.push({ names: [customName.rhythm(sourceName)], image: imageFor(resources, sourceName, 'note_flick_top'), transform: markerTransform })
    }

    for (const key of resources.isHabahiro ? habahiroWidthKeys : ['1']) {
        const sourceName = key === '1' ? 'note_slide_among' : `note_slide_among_${key}`
        output.push({ names: [customName.rhythm(sourceName)], image: imageFor(resources, sourceName, 'note_slide_among'), transform: noteTransform })
    }

    output.push({ names: [customName.rhythm('longNoteLine')], image: resources.longLine, transform: unitTransform })
    output.push({ names: [customName.rhythm('longNoteLine2')], image: resources.longLineSpecial, transform: unitTransform })
    output.push({ names: [customName.rhythm('simultaneous_line')], image: resources.simLine, transform: simLineTransform })

    return output
}

function imageFor(resources: NoteSkinResources, name: string, ...fallbackNames: string[]): ImageAsset {
    const found = resources.sprites.get(name)
    if (found) return found
    for (const fallbackName of fallbackNames) {
        const fallback = resources.sprites.get(fallbackName)
        if (fallback) return fallback
    }
    throw new Error(`${resources.id} missing sprite: ${name}`)
}
