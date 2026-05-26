import sharp from 'sharp'
import type { ImageAsset } from './types.js'

export async function imageFromBuffer(buffer: Buffer): Promise<ImageAsset> {
    const metadata = await sharp(buffer).metadata()
    if (!metadata.width || !metadata.height) {
        throw new Error('image metadata missing width/height')
    }

    const data = await sharp(buffer).ensureAlpha().raw().toBuffer()
    return {
        data,
        width: metadata.width,
        height: metadata.height,
        channels: 4,
    }
}

export function createImage(width: number, height: number): ImageAsset {
    return {
        data: Buffer.alloc(width * height * 4),
        width,
        height,
        channels: 4,
    }
}

export function solidImage(r: number, g: number, b: number, a = 255): ImageAsset {
    return {
        data: Buffer.from([r, g, b, a]),
        width: 1,
        height: 1,
        channels: 4,
    }
}

export function getPixel(image: ImageAsset, x: number, y: number, c: number): number {
    return image.data[(y * image.width + x) * 4 + c] ?? 0
}

export function setPixel(image: ImageAsset, x: number, y: number, c: number, value: number): void {
    image.data[(y * image.width + x) * 4 + c] = clampByte(value)
}

export function interpolateX(image: ImageAsset, x: number, y: number, c: number): number {
    const clampedX = Math.max(0, Math.min(image.width - 1, x))
    if (Number.isInteger(clampedX)) return getPixel(image, clampedX, y, c)

    const left = Math.floor(clampedX)
    const right = Math.ceil(clampedX)
    return getPixel(image, left, y, c) * (right - clampedX) + getPixel(image, right, y, c) * (clampedX - left)
}

export function interpolateY(image: ImageAsset, x: number, y: number, c: number): number {
    const clampedY = Math.max(0, Math.min(image.height - 1, y))
    if (Number.isInteger(clampedY)) return getPixel(image, x, clampedY, c)

    const top = Math.floor(clampedY)
    const bottom = Math.ceil(clampedY)
    return getPixel(image, x, top, c) * (bottom - clampedY) + getPixel(image, x, bottom, c) * (clampedY - top)
}

export async function crop(image: ImageAsset, x: number, y: number, width: number, height: number): Promise<ImageAsset> {
    const left = Math.round(x)
    const top = Math.round(y)
    const normalizedWidth = Math.round(width)
    const normalizedHeight = Math.round(height)
    if (left < 0 || top < 0 || normalizedWidth <= 0 || normalizedHeight <= 0) {
        throw new Error(`invalid crop rect: ${left},${top},${normalizedWidth},${normalizedHeight}`)
    }
    if (left + normalizedWidth > image.width || top + normalizedHeight > image.height) {
        throw new Error(`crop rect exceeds image bounds: ${left},${top},${normalizedWidth},${normalizedHeight} of ${image.width}x${image.height}`)
    }

    const data = await toSharp(image)
        .extract({ left, top, width: normalizedWidth, height: normalizedHeight })
        .raw()
        .toBuffer()

    return {
        data,
        width: normalizedWidth,
        height: normalizedHeight,
        channels: 4,
    }
}

export async function resize(image: ImageAsset, width: number, height: number, kernel: keyof sharp.KernelEnum = 'nearest'): Promise<ImageAsset> {
    const data = await toSharp(image)
        .resize(Math.round(width), Math.round(height), { fit: 'fill', kernel })
        .raw()
        .toBuffer()

    return {
        data,
        width: Math.round(width),
        height: Math.round(height),
        channels: 4,
    }
}

export async function rotate(image: ImageAsset, angle: -90 | 90 | 180): Promise<ImageAsset> {
    const data = await toSharp(image).rotate(angle).raw().toBuffer()
    return {
        data,
        width: angle === 180 ? image.width : image.height,
        height: angle === 180 ? image.height : image.width,
        channels: 4,
    }
}

export function toSharp(image: ImageAsset): sharp.Sharp {
    return sharp(image.data, {
        raw: {
            width: image.width,
            height: image.height,
            channels: 4,
        },
    })
}

function clampByte(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(255, Math.round(value)))
}
