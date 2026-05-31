const fetchAttempts = 3
const fetchTimeoutMs = 90_000

export async function fetchWithRetry(url: string): Promise<Response> {
    let lastError: unknown
    for (let attempt = 1; attempt <= fetchAttempts; attempt++) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(fetchTimeoutMs) })
            if (response.ok || response.status < 500 || attempt === fetchAttempts) return response
            lastError = new Error(`fetch failed ${response.status} on attempt ${attempt}/${fetchAttempts}: ${url}`)
        } catch (error) {
            lastError = new Error(`fetch threw on attempt ${attempt}/${fetchAttempts}: ${url}: ${describeError(error)}`, { cause: error })
            if (attempt === fetchAttempts) break
        }
        await delay(500 * attempt)
    }
    throw lastError
}

function describeError(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`
    return String(error)
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
