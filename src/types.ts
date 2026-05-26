import type { SkinDataTransform } from '@sonolus/core'

export type Server = 'jp' | 'en' | 'tw' | 'cn' | 'kr'

export type LocalizedText = Record<string, string>

export type SkinSource = {
    id: string
    server: Server
    title: string
}

export type ImageAsset = {
    data: Buffer
    width: number
    height: number
    channels: 4
}

export type SpriteAsset = {
    names: string[]
    image: ImageAsset
    transform: SkinDataTransform
}

export type PackedSprite = SpriteAsset & {
    x: number
    y: number
}

export type PackedAtlas = {
    width: number
    height: number
    packed: PackedSprite[]
}

export type GenerationMode = 'normal' | 'habahiro'

export type GenerationPlan = {
    mode: GenerationMode
    rhythm: SkinSource
    directional: SkinSource
    field: SkinSource
}
