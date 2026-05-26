import type { SkinDataTransform } from '@sonolus/core'

export function scale(xr: number, yr: number): SkinDataTransform {
    const xl = xr + (1 - xr) * 0.5
    const xs = (1 - xr) * 0.5
    const yl = yr + (1 - yr) * 0.5
    const ys = (1 - yr) * 0.5

    return {
        x1: { x1: xl * yl, x2: xl * ys, x3: xs * ys, x4: xs * yl },
        y1: { y1: xl * yl, y2: xl * ys, y3: xs * ys, y4: xs * yl },
        x2: { x1: xl * ys, x2: xl * yl, x3: xs * yl, x4: xs * ys },
        y2: { y1: xl * ys, y2: xl * yl, y3: xs * yl, y4: xs * ys },
        x3: { x1: xs * ys, x2: xs * yl, x3: xl * yl, x4: xl * ys },
        y3: { y1: xs * ys, y2: xs * yl, y3: xl * yl, y4: xl * ys },
        x4: { x1: xs * yl, x2: xs * ys, x3: xl * ys, x4: xl * yl },
        y4: { y1: xs * yl, y2: xs * ys, y3: xl * ys, y4: xl * yl },
    }
}
