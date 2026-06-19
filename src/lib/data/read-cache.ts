const entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

/** Short per-instance cache for public live reads; rejected loaders are never retained. */
export function cachedLiveRead<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const current = entries.get(key);
  if (current && current.expiresAt > now) return current.value as Promise<T>;
  const value = loader().catch((error) => {
    entries.delete(key);
    throw error;
  });
  entries.set(key, { expiresAt: now + ttlMs, value });
  return value;
}
