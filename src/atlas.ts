import type { SkinData, SkinDataSprite } from '@sonolus/core'
import { getPixel, setPixel, toSharp } from './image.js'
import type { PackedAtlas, PackedSprite, SpriteAsset } from './types.js'

type Space = {
    x: number
    y: number
    width: number
    height: number
}

export function packSprites(sprites: SpriteAsset[]): PackedAtlas {
    const packed = packShelves(mergeSameImageSprites(sprites))
    const width = Math.max(...packed.map((sprite) => sprite.x + sprite.image.width + 1))
    const height = Math.max(...packed.map((sprite) => sprite.y + sprite.image.height + 1))
    return { width, height, packed }
}

function mergeSameImageSprites(sprites: SpriteAsset[]): SpriteAsset[] {
    const output: SpriteAsset[] = []
    const groups = new Map<string, SpriteAsset>()
    const imageIds = new WeakMap<SpriteAsset['image'], number>()
    let nextImageId = 1
    for (const sprite of sprites) {
        let imageId = imageIds.get(sprite.image)
        if (!imageId) {
            imageId = nextImageId++
            imageIds.set(sprite.image, imageId)
        }
        const key = `${imageId}:${JSON.stringify(sprite.transform)}`
        const existing = groups.get(key)
        if (existing) {
            existing.names.push(...sprite.names)
            continue
        }
        const cloned = { ...sprite, names: [...sprite.names] }
        groups.set(key, cloned)
        output.push(cloned)
    }
    return output
}

export function buildSkinData(width: number, height: number, packed: PackedSprite[]): SkinData {
    const sprites = packed.flatMap((sprite) =>
        sprite.names.map(
            (name): SkinDataSprite => ({
                name,
                x: sprite.x,
                y: sprite.y,
                w: sprite.image.width,
                h: sprite.image.height,
                transform: sprite.transform,
            }),
        ),
    )
    sprites.sort((a, b) => spriteSortKey(a.name).localeCompare(spriteSortKey(b.name)))

    return {
        width,
        height,
        interpolation: true,
        sprites,
    }
}

function spriteSortKey(name: string): string {
    return `${spriteGroup(name).toString().padStart(2, '0')}:${name}`
}

function spriteGroup(name: string): number {
    if (isRhythmName(name)) return 0
    if (isDirectionalName(name)) return 1
    if (isFieldName(name)) return 2
    return 99
}

export async function buildTexture(width: number, height: number, packed: PackedSprite[]): Promise<Buffer> {
    const composites = []
    for (const sprite of packed) {
        const padded = padImage(sprite.image)
        composites.push({
            input: padded.data,
            raw: {
                width: padded.width,
                height: padded.height,
                channels: 4 as const,
            },
            left: sprite.x - 1,
            top: sprite.y - 1,
        })
    }

    return toSharp({
        data: Buffer.alloc(width * height * 4),
        width,
        height,
        channels: 4,
    })
        .composite(composites)
        .png({ compressionLevel: 9 })
        .toBuffer()
}

function packShelves(sprites: SpriteAsset[]): PackedSprite[] {
    const sorted = [...sprites].sort((a, b) => packingSortKey(a).localeCompare(packingSortKey(b)))
    const totalArea = sorted.reduce((sum, sprite) => sum + (sprite.image.width + 2) * (sprite.image.height + 2), 0)
    const maxWidth = Math.max(...sorted.map((sprite) => sprite.image.width + 2))
    const targetWidth = Math.max(maxWidth, Math.ceil(Math.sqrt(totalArea * 1.25)))

    const packed: PackedSprite[] = []
    let x = 0
    let y = 0
    let rowHeight = 0
    let currentGroup = -1
    let currentRowGroup = ''
    for (const sprite of sorted) {
        const group = packingGroup(sprite)
        const rowGroup = packingRowGroup(sprite)
        const width = sprite.image.width + 2
        const height = sprite.image.height + 2
        if (x > 0 && (group !== currentGroup || rowGroup !== currentRowGroup || group === 2 || x + width > targetWidth)) {
            x = 0
            y += rowHeight
            rowHeight = 0
        }
        currentGroup = group
        currentRowGroup = rowGroup
        packed.push({
            ...sprite,
            x: x + 1,
            y: y + 1,
        })
        x += width
        rowHeight = Math.max(rowHeight, height)
    }

    return packed
}

function packingSortKey(sprite: SpriteAsset): string {
    const group = packingGroup(sprite)
    const rowGroup = packingRowGroup(sprite)
    const firstName = packingName(sprite)
    const area = (sprite.image.width + 2) * (sprite.image.height + 2)
    return [
        group.toString().padStart(2, '0'),
        rowGroup,
        String(999999999 - area).padStart(9, '0'),
        firstName,
    ].join(':')
}

function packingGroup(sprite: SpriteAsset): number {
    if (sprite.names.some(isDirectionalName)) return 1
    if (sprite.names.some(isFieldName)) return 2
    return 0
}

function fieldPackingOrder(sprite: SpriteAsset): number {
    if (!sprite.names.some(isFieldName)) return 0
    if (sprite.names.includes('bandori:bg_line_rhythm')) return 0
    if (sprite.names.includes('bandori:game_play_line')) return 1
    if (sprite.names.includes('bandori:game_play_line_skill_adjust_effect')) return 2
    return 3
}

function packingRowGroup(sprite: SpriteAsset): string {
    const group = packingGroup(sprite)
    if (group === 2) return `field-${fieldPackingOrder(sprite).toString().padStart(2, '0')}`

    const name = packingName(sprite)
    if (group === 1) return `directional-${directionalPackingOrder(name).toString().padStart(2, '0')}`
    return `rhythm-${rhythmPackingOrder(name).toString().padStart(2, '0')}`
}

function packingName(sprite: SpriteAsset): string {
    return (
        [...sprite.names].sort((a, b) => {
            const customA = a.startsWith('bandori:') ? 0 : 1
            const customB = b.startsWith('bandori:') ? 0 : 1
            if (customA !== customB) return customA - customB
            return spriteSortKey(a).localeCompare(spriteSortKey(b))
        })[0] ?? ''
    )
}

function rhythmPackingOrder(name: string): number {
    if (name.includes(':note_normal_16')) return 1
    if (name.includes(':note_normal')) return 0
    if (name.includes(':note_skill')) return 2
    if (name.includes(':note_flick_top')) return 4
    if (name.includes(':note_flick')) return 3
    if (name.includes(':note_long_flash')) return 6
    if (name.includes(':note_long')) return 5
    if (name.includes(':note_slide_among')) return 7
    if (name.includes(':longNoteLine')) return 8
    if (name.includes(':longNoteLine2')) return 9
    if (name.includes(':simultaneous_line')) return 10
    if (name.startsWith('#NOTE_CONNECTION_')) return 8
    if (name.startsWith('#SIMULTANEOUS_')) return 10
    if (name.startsWith('#DIRECTIONAL_MARKER_')) return 4
    return 99
}

function directionalPackingOrder(name: string): number {
    if (name.includes(':note_flick_l_') || name.endsWith(':note_flick_l')) return 0
    if (name.includes(':note_flick_r_') || name.endsWith(':note_flick_r')) return 1
    if (name.includes(':note_flick_top_l')) return 2
    if (name.includes(':note_flick_top_r')) return 3
    if (name.includes(':FlickNoteLine_l')) return 4
    if (name.includes(':FlickNoteLine_r')) return 5
    return 99
}

function isRhythmName(name: string): boolean {
    return name.startsWith('bandori:') && !isDirectionalName(name) && !isFieldName(name)
}

function isDirectionalName(name: string): boolean {
    return (
        name.startsWith('bandori:note_flick_l') ||
        name.startsWith('bandori:note_flick_r') ||
        name === 'bandori:note_flick_top_l' ||
        name === 'bandori:note_flick_top_r' ||
        name === 'bandori:FlickNoteLine_l' ||
        name === 'bandori:FlickNoteLine_r'
    )
}

function isFieldName(name: string): boolean {
    return name === 'bandori:bg_line_rhythm' || name === 'bandori:game_play_line' || name === 'bandori:game_play_line_skill_adjust_effect'
}

function padImage(image: SpriteAsset['image']): SpriteAsset['image'] {
    const output: SpriteAsset['image'] = {
        data: Buffer.alloc((image.width + 2) * (image.height + 2) * 4),
        width: image.width + 2,
        height: image.height + 2,
        channels: 4,
    }
    for (let y = 0; y < output.height; y++) {
        const sourceY = Math.max(0, Math.min(image.height - 1, y - 1))
        for (let x = 0; x < output.width; x++) {
            const sourceX = Math.max(0, Math.min(image.width - 1, x - 1))
            for (let c = 0; c < 4; c++) {
                setPixel(output, x, y, c, getPixel(image, sourceX, sourceY, c))
            }
        }
    }
    return output
}
