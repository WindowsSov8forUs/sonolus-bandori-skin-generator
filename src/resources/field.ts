import { customName } from '../constants.js'
import { fetchImageAsset, fetchManifest, requireManifestFile } from '../bestdori.js'
import { scale } from '../transform.js'
import type { ImageAsset, Server, SpriteAsset } from '../types.js'

export type FieldResources = {
    id: string
    server: Server
    stageImage: ImageAsset
    lineImage: ImageAsset
    skillAdjustEffect: ImageAsset
}

export async function getFieldResources(id: string, server: Server): Promise<FieldResources> {
    const manifest = await fetchManifest('fieldskin', server, id)
    const [stageImage, lineImage, skillAdjustEffect] = await Promise.all([
        fetchImageAsset('fieldskin', server, id, requireManifestFile(manifest, 'bg_line_rhythm.png')),
        fetchImageAsset('fieldskin', server, id, requireManifestFile(manifest, 'game_play_line.png')),
        fetchImageAsset('fieldskin', server, id, requireManifestFile(manifest, 'game_play_line_skill_adjust_effect.png')),
    ])

    return {
        id,
        server,
        stageImage,
        lineImage,
        skillAdjustEffect,
    }
}

export async function buildFieldSprites(resources: FieldResources): Promise<SpriteAsset[]> {
    const unitTransform = scale(1, 1)
    const lineTransform = scale(1, resources.lineImage.height / resources.lineImage.width / (90 / 1800))

    return [
        {
            names: [customName.field('game_play_line')],
            image: resources.lineImage,
            transform: lineTransform,
        },
        {
            names: [customName.field('bg_line_rhythm')],
            image: resources.stageImage,
            transform: unitTransform,
        },
        {
            names: [customName.field('game_play_line_skill_adjust_effect')],
            image: resources.skillAdjustEffect,
            transform: unitTransform,
        },
    ]
}
