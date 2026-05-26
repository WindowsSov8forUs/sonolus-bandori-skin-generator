import { crop } from './image.js'
import type { ImageAsset } from './types.js'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type SpriteManifestEntry = {
    Base: {
        m_Name: string
        m_Rect: {
            x: number
            y: number
            width: number
            height: number
        }
        m_RD?: {
            texture?: {
                m_PathID?: string | number
            }
        }
    }
}

type BundleManifest = {
    Base: {
        m_PreloadTable: {
            m_PathID: string
        }[]
        m_Container: Record<
            string,
            {
                preloadIndex: number
                preloadSize: number
            }
        >
    }
}

export function parseSprites(raw: string): SpriteManifestEntry[] {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) throw new Error('.sprites must be an array')
    return parsed.map((entry, index) => {
        const object = requireObject(entry, `.sprites[${index}]`)
        const base = requireObject(object.Base, `.sprites[${index}].Base`)
        const rect = requireObject(base.m_Rect, `.sprites[${index}].Base.m_Rect`)
        const parsedEntry: SpriteManifestEntry = {
            Base: {
                m_Name: requireString(base.m_Name, `.sprites[${index}].Base.m_Name`),
                m_Rect: {
                    x: requireNumber(rect.x, `.sprites[${index}].Base.m_Rect.x`),
                    y: requireNumber(rect.y, `.sprites[${index}].Base.m_Rect.y`),
                    width: requireNumber(rect.width, `.sprites[${index}].Base.m_Rect.width`),
                    height: requireNumber(rect.height, `.sprites[${index}].Base.m_Rect.height`),
                },
            },
        }
        const rd = objectToJson(base.m_RD) as SpriteManifestEntry['Base']['m_RD'] | undefined
        if (rd !== undefined) parsedEntry.Base.m_RD = rd
        return parsedEntry
    })
}

export function parseBundle(raw: string): BundleManifest {
    const parsed = requireObject(JSON.parse(raw) as unknown, 'bundle')
    const base = requireObject(parsed.Base, 'bundle.Base')
    const preloadTable = requireArray(base.m_PreloadTable, 'bundle.Base.m_PreloadTable').map((entry, index) => {
        const object = requireObject(entry, `bundle.Base.m_PreloadTable[${index}]`)
        return { m_PathID: requireString(object.m_PathID, `bundle.Base.m_PreloadTable[${index}].m_PathID`) }
    })

    const rawContainer = requireObject(base.m_Container, 'bundle.Base.m_Container')
    const m_Container: BundleManifest['Base']['m_Container'] = {}
    for (const [key, value] of Object.entries(rawContainer)) {
        const object = requireObject(value, `bundle.Base.m_Container.${key}`)
        m_Container[key] = {
            preloadIndex: requireNumber(object.preloadIndex, `bundle.Base.m_Container.${key}.preloadIndex`),
            preloadSize: requireNumber(object.preloadSize, `bundle.Base.m_Container.${key}.preloadSize`),
        }
    }

    return { Base: { m_PreloadTable: preloadTable, m_Container } }
}

export async function extractNamedSprites(params: {
    sprites: SpriteManifestEntry[]
    bundle: BundleManifest
    imagesByFile: Map<string, ImageAsset>
}): Promise<Map<string, ImageAsset>> {
    const pathIdToAtlas = buildAtlasFileByPreloadRange(params.bundle)
    const output = new Map<string, ImageAsset>()

    for (const entry of params.sprites) {
        const name = entry.Base.m_Name
        if (!name) continue

        const texturePathId = resolveSpriteTexturePathId(entry)
        const atlasFile = texturePathId ? pathIdToAtlas.get(texturePathId) : undefined
        if (!atlasFile) throw new Error(`cannot resolve atlas file for sprite: ${name}`)

        const image = params.imagesByFile.get(atlasFile.toLowerCase())
        if (!image) throw new Error(`atlas image missing: ${atlasFile}`)

        const rect = entry.Base.m_Rect
        output.set(
            name,
            await crop(
                image,
                Math.round(rect.x),
                Math.round(image.height - rect.y - rect.height),
                Math.round(rect.width),
                Math.round(rect.height),
            ),
        )
    }

    return output
}

function buildAtlasFileByPreloadRange(bundle: BundleManifest): Map<string, string> {
    const output = new Map<string, string>()
    for (const [assetPath, containerEntry] of Object.entries(bundle.Base.m_Container)) {
        const atlasFile = getFileName(assetPath)
        if (!atlasFile.toLowerCase().endsWith('.png')) continue

        const start = Math.max(0, Math.floor(containerEntry.preloadIndex))
        const end = Math.min(bundle.Base.m_PreloadTable.length, start + Math.max(0, Math.floor(containerEntry.preloadSize)))
        for (let index = start; index < end; index++) {
            const pathId = bundle.Base.m_PreloadTable[index]?.m_PathID
            if (pathId && !output.has(pathId)) output.set(pathId, atlasFile)
        }
    }
    return output
}

function resolveSpriteTexturePathId(entry: SpriteManifestEntry): string | null {
    const pathId = entry.Base.m_RD?.texture?.m_PathID
    if (typeof pathId === 'string' && pathId.length > 0) return pathId
    if (typeof pathId === 'number' && Number.isFinite(pathId)) return String(pathId)
    return null
}

function getFileName(path: string): string {
    const normalized = path.replace(/\\/g, '/')
    return normalized.split('/').at(-1)?.toLowerCase() ?? normalized.toLowerCase()
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${label} must be an object`)
    }
    return value as Record<string, unknown>
}

function requireArray(value: unknown, label: string): unknown[] {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
    return value
}

function requireString(value: unknown, label: string): string {
    if (typeof value !== 'string') throw new Error(`${label} must be a string`)
    return value
}

function requireNumber(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`)
    return value
}

function objectToJson(value: unknown): JsonValue | undefined {
    if (value === undefined) return undefined
    return value as JsonValue
}
