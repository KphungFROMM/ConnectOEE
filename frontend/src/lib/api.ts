// Thin fetch wrapper. Uses same-origin paths (dev proxy -> :5080, prod -> single port).

import { getToken } from './auth'



let onUnauthorized: (() => void) | null = null



export function setUnauthorizedHandler(handler: () => void) {

  onUnauthorized = handler

}



function authHeaders(): Record<string, string> {

  const token = getToken()

  return token ? { Authorization: `Bearer ${token}` } : {}

}



async function readErrorMessage(res: Response, fallback: string): Promise<string> {

  try {

    const body = (await res.json()) as {

      message?: string

      title?: string

      detail?: string

      errors?: Record<string, string[]>

    }

    if (body?.message) return body.message

    if (body?.errors) {

      const first = Object.values(body.errors).flat()[0]

      if (first) return first

    }

    if (body?.detail) return body.detail

    if (body?.title && body.title !== 'One or more validation errors occurred.') return body.title

  } catch {

    /* ignore */

  }

  return fallback

}



async function send<T>(method: string, path: string, body?: unknown): Promise<T> {

  const res = await fetch(path, {

    method,

    headers: {

      'Content-Type': 'application/json',

      Accept: 'application/json',

      ...authHeaders(),

    },

    credentials: 'include',

    body: body === undefined ? undefined : JSON.stringify(body),

  })



  if (res.status === 401) {

    onUnauthorized?.()

    throw new Error('Session expired — please sign in again')

  }



  if (!res.ok) {

    throw new Error(await readErrorMessage(res, `${method} ${path} failed: ${res.status}`))

  }

  return (res.status === 204 ? (undefined as T) : ((await res.json()) as T))

}



export async function apiGet<T>(path: string): Promise<T> {

  return send<T>('GET', path)

}



export async function apiPost<T>(path: string, body: unknown): Promise<T> {

  return send<T>('POST', path, body)

}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {

  return send<T>('PATCH', path, body)

}



/** Probes backend readiness (DB reachable). Returns true on HTTP 200. */

export async function checkReady(): Promise<boolean> {

  try {

    const res = await fetch('/health/ready', { cache: 'no-store' })

    return res.ok

  } catch {

    return false

  }

}

