import fs from 'fs-extra'
import os from 'node:os'
import { getGenerationPlans, getGenerationPlanSummary } from './catalog.js'
import { createGenerationResourceCache, generateSkin, isSkinGenerated, skinName } from './generate.js'
import { verifyOutput } from './verify.js'

const outputRoot = 'output'
const sample = process.argv.includes('--sample')
const listPlans = process.argv.includes('--list-plans')
const concurrency = getConcurrency()

if (listPlans) {
    const summary = await getGenerationPlanSummary(sample)
    console.log(summary.join('\n'))
    process.exit(0)
}

await fs.ensureDir(outputRoot)

const plans = await getGenerationPlans(sample)
if (plans.length === 0) throw new Error('no generation plans found')

console.log(`Generating ${plans.length} skin pack(s) into ${outputRoot} with concurrency ${concurrency}`)
const cache = createGenerationResourceCache()
await runConcurrent(plans, concurrency, async (plan, index) => {
    const name = skinName(plan)
    if (await isSkinGenerated(plan, outputRoot)) {
        console.log(`[${index + 1}/${plans.length}] ${name} (skip)`)
        return
    }

    console.log(`[${index + 1}/${plans.length}] ${name}`)
    try {
        await generateSkin(plan, outputRoot, cache)
    } catch (error) {
        throw new Error(`failed to generate ${name}: ${describeError(error)}`, { cause: error })
    }
})

await verifyOutput(outputRoot, plans.map(skinName))
console.log(`Generated ${plans.length} skin pack(s) into ${outputRoot}`)

function getConcurrency(): number {
    const index = process.argv.indexOf('--concurrency')
    const value = index >= 0 ? process.argv[index + 1] : process.env.SKIN_GENERATOR_CONCURRENCY
    const parsed = value ? Number.parseInt(value, 10) : Number.NaN
    if (Number.isInteger(parsed) && parsed > 0) return parsed
    return Math.max(1, Math.min(4, os.cpus().length))
}

async function runConcurrent<T>(items: readonly T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
    let nextIndex = 0
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (true) {
            const index = nextIndex++
            if (index >= items.length) return
            await worker(items[index]!, index)
        }
    })
    await Promise.all(workers)
}

function describeError(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`
    return String(error)
}
