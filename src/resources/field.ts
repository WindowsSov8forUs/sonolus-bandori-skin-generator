import { SkinSpriteName } from '@sonolus/core'
import { customName } from '../constants.js'
import { fetchImageAsset, fetchManifest, requireManifestFile } from '../bestdori.js'
import { scale } from '../transform.js'
import type { ImageAsset, Server, SpriteAsset } from '../types.js'
import { deriveFieldResources, type DerivedFieldResources } from './lane.js'

export type FieldResources = DerivedFieldResources & {
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

    const derived = await deriveFieldResources(stageImage, lineImage)

    return {
        id,
        server,
        stageImage,
        lineImage,
        skillAdjustEffect,
        ...derived,
    }
}

export async function buildFieldSprites(resources: FieldResources): Promise<SpriteAsset[]> {
    const unitTransform = scale(1, 1)
    const lineTransform = scale(1, resources.lineImage.height / resources.lineImage.width / (90 / 1800))
    const judgmentLineTransform = scale(1, 0.5)

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
        {
            names: [SkinSpriteName.StageMiddle],
            image: resources.middle,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.StageLeftBorder, SkinSpriteName.StageLeftBorderSeamless],
            image: resources.borderLeft,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.StageRightBorder, SkinSpriteName.StageRightBorderSeamless],
            image: resources.borderRight,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.StageTopBorder, SkinSpriteName.StageTopBorderSeamless],
            image: resources.borderTop,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.StageBottomBorder, SkinSpriteName.StageBottomBorderSeamless],
            image: resources.borderBottom,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.StageTopLeftCorner],
            image: resources.cornerTopLeft,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.StageTopRightCorner],
            image: resources.cornerTopRight,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.StageBottomLeftCorner],
            image: resources.cornerBottomLeft,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.StageBottomRightCorner],
            image: resources.cornerBottomRight,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.Lane, SkinSpriteName.LaneSeamless],
            image: resources.lane,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.LaneAlternative, SkinSpriteName.LaneAlternativeSeamless],
            image: resources.laneAlternative,
            transform: unitTransform,
        },
        {
            names: [SkinSpriteName.JudgmentLine],
            image: resources.line,
            transform: judgmentLineTransform,
        },
        {
            names: [SkinSpriteName.NoteSlot],
            image: resources.slot,
            transform: unitTransform,
        },
    ]
}
