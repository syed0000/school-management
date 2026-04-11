type Limiter = {
  active: number
  queue: Array<() => void>
}

declare global {
  var __limiters: Map<string, Limiter> | undefined
}

const limiters = globalThis.__limiters ?? new Map<string, Limiter>()
globalThis.__limiters = limiters

export async function withConcurrencyLimit<T>(
  key: string,
  limit: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (!Number.isFinite(limit) || limit <= 0) return fn()

  const limiter = limiters.get(key) ?? { active: 0, queue: [] }
  limiters.set(key, limiter)

  if (limiter.active >= limit) {
    await new Promise<void>((resolve) => {
      limiter.queue.push(resolve)
    })
  }

  limiter.active++
  try {
    return await fn()
  } finally {
    limiter.active--
    const next = limiter.queue.shift()
    if (next) next()
  }
}

