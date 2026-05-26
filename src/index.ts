import fs from 'fs-extra'
import { getGenerationPlans, getGenerationPlanSummary } from './catalog.js'
import { createGenerationResourceCache, generateSkin, skinName } from './generate.js'
import { verifyOutput } from './verify.js'

const outputRoot = 'output'
const skinsRoot = `${outputRoot}/skins`
const sample = process.argv.includes('--sample')
const listPlans = process.argv.includes('--list-plans')

if (listPlans) {
    const summary = await getGenerationPlanSummary(sample)
    console.log(summary.join('\n'))
    process.exit(0)
}

await fs.emptyDir(outputRoot)

const plans = await getGenerationPlans(sample)
if (plans.length === 0) throw new Error('no generation plans found')

console.log(`Generating ${plans.length} skin pack(s) into ${skinsRoot}`)
const cache = createGenerationResourceCache()
for (let index = 0; index < plans.length; index++) {
    const plan = plans[index]!
    console.log(`[${index + 1}/${plans.length}] ${skinName(plan)}`)
    await generateSkin(plan, skinsRoot, cache)
}

await verifyOutput(outputRoot, plans.length)
console.log(`Generated ${plans.length} skin pack(s) into ${outputRoot}`)
