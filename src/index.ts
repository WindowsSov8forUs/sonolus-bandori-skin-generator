import fs from 'fs-extra'
import os from 'node:os'
import { getGenerationPlans, getGenerationPlanSummary } from './catalog.js'
import { createGenerationResourceCache, generateSkin, skinName } from './generate.js'
import { verifyOutput } from './verify.js'

const outputRoot = 'output'
const skinsRoot = `${outputRoot}/skins`
const sample = process.argv.includes('--sample')
const listPlans = process.argv.includes('--list-plans')
const concurrency = getConcurrency()

if (listPlans) {
    const summary = await getGenerationPlanSummary(sample)
    console.log(summary.join('\n'))
    process.exit(0)
}

await fs.emptyDir(outputRoot)

const plans = await getGenerationPlans(sample)
if (plans.length === 0) throw new Error('no generation plans found')

console.log(`Generating ${plans.length} skin pack(s) into ${skinsRoot} with concurrency ${concurrency}`)
const cache = createGenerationResourceCache()
await runConcurrent(plans, concurrency, async (plan, index) => {
    console.log(`[${index + 1}/${plans.length}] ${skinName(plan)}`)
    await generateSkin(plan, skinsRoot, cache)
})

await verifyOutput(outputRoot, plans.length)
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
