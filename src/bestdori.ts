import { bestdoriRoot } from './constants.js'
import { imageFromBuffer } from './image.js'
import type { ImageAsset, Server } from './types.js'

export type AssetNamespace = 'noteskin' | 'fieldskin'

const roots = {
    noteskin: {
        asset: '/assets/{server}/ingameskin/noteskin',
        manifest: '/api/explorer/{server}/assets/ingameskin/noteskin',
    },
    fieldskin: {
        asset: '/assets/{server}/ingameskin/fieldskin',
        manifest: '/api/explorer/{server}/assets/ingameskin/fieldskin',
    },
} as const

const fetchAttempts = 3
const fetchTimeoutMs = 90_000

export async function fetchManifest(namespace: AssetNamespace, server: Server, ripName: string): Promise<string[]> {
    const url = `${bestdoriRoot}${roots[namespace].manifest.replace('{server}', server)}/${ripName}.json`
    const response = await fetchWithRetry(url)
    if (!response.ok) throw new Error(`manifest fetch failed ${response.status}: ${url}`)
    const json = (await response.json()) as unknown
    if (!Array.isArray(json) || !json.every((value) => typeof value === 'string')) {
        throw new Error(`manifest is not a string array: ${url}`)
    }
    return json
}

export async function fetchText(namespace: AssetNamespace, server: Server, ripName: string, fileName: string): Promise<string> {
    const url = assetUrl(namespace, server, ripName, fileName)
    const response = await fetchWithRetry(url)
    if (!response.ok) throw new Error(`text fetch failed ${response.status}: ${url}`)
    return response.text()
}

export async function fetchImageAsset(namespace: AssetNamespace, server: Server, ripName: string, fileName: string): Promise<ImageAsset> {
    const url = assetUrl(namespace, server, ripName, fileName)
    const response = await fetchWithRetry(url)
    if (!response.ok) throw new Error(`image fetch failed ${response.status}: ${url}`)
    return imageFromBuffer(Buffer.from(await response.arrayBuffer()))
}

export function assetUrl(namespace: AssetNamespace, server: Server, ripName: string, fileName: string): string {
    const root = roots[namespace].asset.replace('{server}', server)
    return `${bestdoriRoot}${root}/${ripName}_rip/${encodePathFile(fileName)}`
}

export function requireManifestFile(files: readonly string[], fileName: string): string {
    const normalized = fileName.toLowerCase()
    const found = files.find((file) => file.toLowerCase() === normalized)
    if (!found) throw new Error(`manifest missing file: ${fileName}`)
    return found
}

function encodePathFile(fileName: string): string {
    return fileName.split('/').map(encodeURIComponent).join('/')
}

async function fetchWithRetry(url: string): Promise<Response> {
    let lastError: unknown
    for (let attempt = 1; attempt <= fetchAttempts; attempt++) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(fetchTimeoutMs) })
            if (response.ok || response.status < 500 || attempt === fetchAttempts) return response
            lastError = new Error(`fetch failed ${response.status}: ${url}`)
        } catch (error) {
            lastError = error
            if (attempt === fetchAttempts) break
        }
        await delay(500 * attempt)
    }
    throw lastError
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
