import { createImage, getPixel, interpolateX, interpolateY, rotate, setPixel } from '../image.js'
import type { ImageAsset } from '../types.js'

export type DerivedFieldResources = {
    lane: ImageAsset
    laneAlternative: ImageAsset
    middle: ImageAsset
    borderLeft: ImageAsset
    borderRight: ImageAsset
    borderTop: ImageAsset
    borderBottom: ImageAsset
    cornerTopLeft: ImageAsset
    cornerTopRight: ImageAsset
    cornerBottomLeft: ImageAsset
    cornerBottomRight: ImageAsset
    line: ImageAsset
    slot: ImageAsset
}

export async function deriveFieldResources(stageImage: ImageAsset, lineImage: ImageAsset): Promise<DerivedFieldResources> {
    const topRatio = findMinimum(0.01, 0.025, 0.0001, (value) => getTopRatioFitness(stageImage, value))
    const flattened = stretchTop(stageImage, topRatio)
    const laneRatio = findMinimum(0.13, 0.135, 0.0001, (value) => getLaneRatioFitness(flattened, value))

    const lane = mirrorAverageHeight(merge(flattened, [0.5 - laneRatio * 2, 0.5, 0.5 + laneRatio * 2], laneRatio))
    const laneAlternative = mirrorAverageHeight(merge(flattened, [0.5 - laneRatio * 3, 0.5 - laneRatio, 0.5 + laneRatio, 0.5 + laneRatio * 3], laneRatio))
    const middle = middleAverage(lane)

    const borderRatio = 0.5 - laneRatio * 3.5
    const borderLeft = merge(mirrorAverageHeight(flattened), [borderRatio / 2], borderRatio)
    const [borderRight, borderTop, borderBottom] = await Promise.all([rotate(borderLeft, 180), rotate(borderLeft, 90), rotate(borderLeft, -90)])

    const cornerTopLeft = cornerize(borderLeft)
    const [cornerTopRight, cornerBottomLeft, cornerBottomRight] = await Promise.all([
        rotate(cornerTopLeft, 90),
        rotate(cornerTopLeft, -90),
        rotate(cornerTopLeft, 180),
    ])

    const line = flattenWidth(lineImage)
    const slot = circularize(mirrorAverageWidth(line))

    return {
        lane,
        laneAlternative,
        middle,
        borderLeft,
        borderRight,
        borderTop,
        borderBottom,
        cornerTopLeft,
        cornerTopRight,
        cornerBottomLeft,
        cornerBottomRight,
        line,
        slot,
    }
}

function findMinimum(minimum: number, maximum: number, interval: number, fitness: (value: number) => number): number {
    let bestValue = minimum
    let bestFitness = Number.POSITIVE_INFINITY
    for (let value = minimum; value <= maximum + interval / 2; value += interval) {
        const currentFitness = fitness(value)
        if (currentFitness < bestFitness) {
            bestValue = value
            bestFitness = currentFitness
        }
    }
    return bestValue
}

function getTopRatioFitness(image: ImageAsset, topRatio: number): number {
    const accumulators = Array.from({ length: image.width * 4 }, () => ({ count: 0, mean: 0, m2: 0 }))
    const center = (image.width - 1) / 2

    for (let y = 0; y < image.height; y++) {
        const ratio = topRatio + (y / (image.height - 1)) * (1 - topRatio)
        for (let x = 0; x < image.width; x++) {
            const nx = (x - center) * ratio + center
            for (let c = 0; c < 4; c++) {
                const accumulator = accumulators[x * 4 + c]!
                const value = interpolateX(image, nx, y, c)
                accumulator.count++
                const delta = value - accumulator.mean
                accumulator.mean += delta / accumulator.count
                accumulator.m2 += delta * (value - accumulator.mean)
            }
        }
    }

    return accumulators.reduce((sum, accumulator) => sum + accumulator.m2, 0)
}

function stretchTop(image: ImageAsset, topRatio: number): ImageAsset {
    const output = createImage(image.width, 1)
    const center = (image.width - 1) / 2

    for (let x = 0; x < image.width; x++) {
        for (let c = 0; c < 4; c++) {
            let sum = 0
            for (let y = 0; y < image.height; y++) {
                const ratio = topRatio + (y / (image.height - 1)) * (1 - topRatio)
                const nx = (x - center) * ratio + center
                sum += interpolateX(image, nx, y, c)
            }
            setPixel(output, x, 0, c, sum / image.height)
        }
    }

    return output
}

function getLaneRatioFitness(image: ImageAsset, laneRatio: number): number {
    const offset = image.width * laneRatio * 2
    let output = 0

    for (let x = 0; x < image.width; x++) {
        if (x < image.width * 0.1 || x > image.width * 0.9) continue

        const nx = x - offset
        if (nx < 0 || nx > image.width - 1) continue

        for (let c = 0; c < 4; c++) {
            output += Math.abs(getPixel(image, x, 0, c) - interpolateX(image, nx, 0, c))
        }
    }

    return output
}

function merge(image: ImageAsset, centers: number[], size: number): ImageAsset {
    const outputWidth = Math.ceil(image.width * size)
    const output = createImage(outputWidth, 1)

    for (let x = 0; x < output.width; x++) {
        for (let c = 0; c < 4; c++) {
            let sum = 0
            for (const center of centers) {
                const offset = (center - size / 2) * (image.width - 1)
                const nx = output.width === 1 ? offset : (x / (output.width - 1)) * (image.width * size) + offset
                sum += interpolateX(image, nx, 0, c)
            }
            setPixel(output, x, 0, c, sum / centers.length)
        }
    }

    return output
}

function mirrorAverageHeight(image: ImageAsset): ImageAsset {
    const output = createImage(image.width, image.height)
    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            for (let c = 0; c < 4; c++) {
                setPixel(output, x, y, c, (getPixel(image, x, y, c) + getPixel(image, image.width - 1 - x, y, c)) / 2)
            }
        }
    }
    return output
}

function mirrorAverageWidth(image: ImageAsset): ImageAsset {
    const output = createImage(image.width, image.height)
    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            for (let c = 0; c < 4; c++) {
                setPixel(output, x, y, c, (getPixel(image, x, y, c) + getPixel(image, x, image.height - 1 - y, c)) / 2)
            }
        }
    }
    return output
}

function middleAverage(image: ImageAsset): ImageAsset {
    const output = createImage(1, 1)
    for (let c = 0; c < 4; c++) {
        let count = 0
        let sum = 0
        for (let x = 0; x < image.width; x++) {
            const ratio = x / (image.width - 1)
            if (ratio < 0.1 || ratio > 0.9) continue
            sum += getPixel(image, x, 0, c)
            count++
        }
        setPixel(output, 0, 0, c, sum / count)
    }
    return output
}

function cornerize(image: ImageAsset): ImageAsset {
    const output = createImage(image.width, image.width)
    for (let y = 0; y < output.height; y++) {
        for (let x = 0; x < output.width; x++) {
            for (let c = 0; c < 4; c++) {
                setPixel(output, x, y, c, getPixel(image, Math.min(x, y), 0, c))
            }
        }
    }
    return output
}

function flattenWidth(image: ImageAsset): ImageAsset {
    const output = createImage(1, image.height)
    for (let y = 0; y < image.height; y++) {
        for (let c = 0; c < 4; c++) {
            let sum = 0
            for (let x = 0; x < image.width; x++) {
                sum += getPixel(image, x, y, c)
            }
            setPixel(output, 0, y, c, sum / image.width)
        }
    }
    return output
}

function circularize(image: ImageAsset): ImageAsset {
    const output = createImage(image.height, image.height)
    const center = (image.height - 1) / 2

    for (let y = 0; y < output.height; y++) {
        for (let x = 0; x < output.width; x++) {
            const radius = Math.sqrt((x - center) ** 2 + (y - center) ** 2)
            const ny = Math.max(0, center - radius)
            for (let c = 0; c < 4; c++) {
                setPixel(output, x, y, c, interpolateY(image, 0, ny, c))
            }
        }
    }

    return output
}
