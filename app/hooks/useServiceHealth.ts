import { useEffect, useRef, useState } from 'react'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from '../lib/firebase/client'

const CLOUD_RUN_URL = (
  process.env.EXPO_PUBLIC_CLOUD_RUN_URL ?? 'http://localhost:8081'
).replace(/\/$/, '')

const RETRY_DELAY_MS = 30_000

export type ServiceStatus = 'ok' | 'error' | 'checking'

export interface ServiceHealth {
  firebase: ServiceStatus
  cloudRun: ServiceStatus
  livekit: ServiceStatus
  cloudRunError?: string
}

export function useServiceHealth(): ServiceHealth {
  const [health, setHealth] = useState<ServiceHealth>({
    firebase: 'checking',
    cloudRun: 'checking',
    livekit: 'checking',
  })
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function runChecks() {
    let firebaseStatus: ServiceStatus = 'error'
    try {
      await getDocs(query(collection(db, 'sessions'), limit(1)))
      firebaseStatus = 'ok'
    } catch {
      firebaseStatus = 'error'
    }

    let cloudRunStatus: ServiceStatus = 'error'
    let livekitStatus: ServiceStatus = 'error'
    let cloudRunError: string | undefined

    try {
      const res = await fetch(`${CLOUD_RUN_URL}/health`)
      const json = (await res.json()) as {
        status: string
        firebase: string
        livekit: string
      }
      cloudRunStatus = json.status === 'ok' ? 'ok' : 'error'
      livekitStatus = json.livekit === 'ok' ? 'ok' : 'error'
      if (cloudRunStatus === 'error' || livekitStatus === 'error') {
        const parts: string[] = []
        if (json.firebase !== 'ok') parts.push(`Firebase: ${json.firebase}`)
        if (json.livekit !== 'ok') parts.push(`LiveKit: ${json.livekit}`)
        cloudRunError = parts.join(' · ')
      }
    } catch (e) {
      cloudRunStatus = 'error'
      livekitStatus = 'error'
      cloudRunError = e instanceof Error ? e.message : 'Network error'
    }

    const next: ServiceHealth = {
      firebase: firebaseStatus,
      cloudRun: cloudRunStatus,
      livekit: livekitStatus,
      cloudRunError,
    }
    setHealth(next)

    if (firebaseStatus === 'error' || cloudRunStatus === 'error' || livekitStatus === 'error') {
      retryRef.current = setTimeout(runChecks, RETRY_DELAY_MS)
    }
  }

  useEffect(() => {
    void runChecks()
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return health
}
