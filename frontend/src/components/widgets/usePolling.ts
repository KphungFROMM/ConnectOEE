import { useEffect, useRef, useState } from 'react'

/** Polls an async fetcher on an interval, returning the latest data + loading state. */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let active = true
    async function run() {
      try {
        const result = await fetcherRef.current()
        if (active) {
          setData(result)
          setError(false)
        }
      } catch {
        if (active) setError(true)
      }
    }
    void run()
    const id = setInterval(run, intervalMs)
    return () => {
      active = false
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error }
}
