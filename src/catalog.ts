import { servers } from './constants.js'
import type { GenerationPlan, Server, SkinSource } from './types.js'

type BestdoriInfoEntry = {
    assetBundleName?: string
    skinName?: (string | null)[]
}

type BestdoriAssetsInfo = {
    ingameskin?: {
        noteskin?: Record<string, unknown>
        fieldskin?: Record<string, unknown>
    }
}

type Catalog = {
    normal: SkinSourceGroup
    habahiro: SkinSourceGroup
}

type SkinSourceGroup = {
    rhythms: SkinSource[]
    directionals: SkinSource[]
    fields: SkinSource[]
}

const bestdoriRoot = 'https://bestdori.com'
const fetchAttempts = 3
const fetchTimeoutMs = 90_000

export async function getGenerationPlans(sample: boolean): Promise<GenerationPlan[]> {
    const catalog = await getCatalog()
    const normal = sampleGroup(catalog.normal, sample)
    const habahiro = sampleGroup(catalog.habahiro, sample)

    const normalPlans = combine('normal', normal)
    const habahiroPlans = combine('habahiro', habahiro)
    return [...normalPlans, ...habahiroPlans]
}

export async function getGenerationPlanSummary(sample: boolean): Promise<string[]> {
    const catalog = await getCatalog()
    const normal = sampleGroup(catalog.normal, sample)
    const habahiro = sampleGroup(catalog.habahiro, sample)
    return [
        describeGroup('normal', normal),
        describeGroup('habahiro', habahiro),
        `total: ${countCombinations(normal) + countCombinations(habahiro)} pack(s)`,
    ]
}

async function getCatalog(): Promise<Catalog> {
    const [assetInfos, noteInfo, directionalInfo, fieldInfo] = await Promise.all([
        Promise.all(servers.map((server) => fetchJson<BestdoriAssetsInfo>(`/api/explorer/${server}/assets/_info.json`))),
        fetchJson<Record<string, BestdoriInfoEntry>>('/api/skin/notes.all.3.json'),
        fetchJson<Record<string, BestdoriInfoEntry>>('/api/skin/directionalFlicks.all.3.json'),
        fetchJson<Record<string, BestdoriInfoEntry>>('/api/skin/lanes.all.3.json'),
    ])

    for (const skin of Object.values(directionalInfo)) {
        if (typeof skin.assetBundleName === 'string') {
            skin.assetBundleName = `directionalflick${skin.assetBundleName}`
        }
    }

    const noteskinByServer = collectByServer(assetInfos, (info) => info.ingameskin?.noteskin ?? {})
    const fieldskinByServer = collectByServer(assetInfos, (info) => info.ingameskin?.fieldskin ?? {})

    const allRhythms = sourceList(noteskinByServer, noteInfo, (id) => !id.startsWith('directionalflick') && !id.endsWith('sample'))
    const allDirectionals = sourceList(noteskinByServer, directionalInfo, (id) => id.startsWith('directionalflick') && !id.endsWith('sample'))
    const allFields = sourceList(fieldskinByServer, fieldInfo, () => true)

    const directionals = allDirectionals
    return {
        normal: {
            rhythms: allRhythms.filter((source) => source.id !== 'habahiro'),
            directionals,
            fields: allFields.filter((source) => source.id !== 'habahiro'),
        },
        habahiro: {
            rhythms: allRhythms.filter((source) => source.id === 'habahiro'),
            directionals,
            fields: allFields.filter((source) => source.id === 'habahiro'),
        },
    }
}

function collectByServer(assetInfos: BestdoriAssetsInfo[], getter: (info: BestdoriAssetsInfo) => Record<string, unknown>): Map<string, Server> {
    const output = new Map<string, Server>()
    for (let index = 0; index < servers.length; index++) {
        const server = servers[index]!
        const names = Object.keys(getter(assetInfos[index]!))
        for (const name of names) {
            if (!output.has(name)) output.set(name, server)
        }
    }
    return output
}

function sourceList(byServer: Map<string, Server>, info: Record<string, BestdoriInfoEntry>, filter: (id: string) => boolean): SkinSource[] {
    return [...byServer.entries()]
        .filter(([id]) => filter(id))
        .map(([id, server]) => ({
            id,
            server,
            title: getTitle(info, id),
        }))
        .sort((a, b) => serverPriority(a.server) - serverPriority(b.server) || idPriority(a.id) - idPriority(b.id) || a.id.localeCompare(b.id))
}

function getTitle(info: Record<string, BestdoriInfoEntry>, id: string): string {
    const entry = Object.values(info).find((value) => value.assetBundleName === id)
    const fallback = clean(id)
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    return entry?.skinName?.find((name): name is string => typeof name === 'string' && name.length > 0) ?? fallback
}

function clean(name: string): string {
    if (name.startsWith('directionalflickskin_')) return name.slice(21)
    if (name.startsWith('directionalflickskin')) return name.slice(20)
    if (name.startsWith('skin_')) return name.slice(5)
    if (name.startsWith('skin')) return name.slice(4)
    return name
}

function serverPriority(server: Server): number {
    return servers.indexOf(server)
}

function idPriority(id: string): number {
    if (id === 'skin00' || id === 'directionalflickskin00') return 0
    if (/^(?:directionalflick)?skin\d+$/i.test(id)) return 1
    return 2
}

function sampleGroup(group: SkinSourceGroup, sample: boolean): SkinSourceGroup {
    if (!sample) return group
    return {
        rhythms: group.rhythms.slice(0, 1),
        directionals: group.directionals.slice(0, 1),
        fields: group.fields.slice(0, 1),
    }
}

function describeGroup(name: string, group: SkinSourceGroup): string {
    return `${name}: ${group.rhythms.length} RhythmSkin * ${group.directionals.length} DirectionalFlickSkin * ${group.fields.length} FieldSkin = ${countCombinations(group)} pack(s)`
}

function countCombinations(group: SkinSourceGroup): number {
    return group.rhythms.length * group.directionals.length * group.fields.length
}

function combine(mode: GenerationPlan['mode'], group: SkinSourceGroup): GenerationPlan[] {
    const output: GenerationPlan[] = []
    for (const rhythm of group.rhythms) {
        for (const directional of group.directionals) {
            for (const field of group.fields) {
                output.push({ mode, rhythm, directional, field })
            }
        }
    }
    return output
}

async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetchWithRetry(`${bestdoriRoot}${path}`)
    if (!response.ok) throw new Error(`fetch failed ${response.status}: ${path}`)
    return (await response.json()) as T
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
