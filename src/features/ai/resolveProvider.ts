import { loadSettings } from '@/lib/storage/settings'
import type { AiConnectionStatus, AiProvider } from './provider'
import { HttpAiProvider } from './providers/httpProvider'
import { MockAiProvider } from './providers/mockProvider'

const mock = new MockAiProvider()
const http = new HttpAiProvider()

export async function resolveAiProvider(): Promise<{
  provider: AiProvider
  status: AiConnectionStatus
}> {
  const settings = loadSettings()
  if (settings.aiMode === 'mock') {
    return { provider: mock, status: 'MOCK' }
  }
  if (settings.aiMode === 'http') {
    const status = await http.getStatus()
    if (status === 'OFFLINE' || status === 'UNAVAILABLE') {
      return { provider: http, status }
    }
    return { provider: http, status: 'LIVE' }
  }

  // auto: prefer live when available, else mock
  const status = await http.getStatus()
  if (status === 'LIVE') {
    return { provider: http, status }
  }
  if (status === 'OFFLINE') {
    return { provider: http, status: 'OFFLINE' }
  }
  return { provider: mock, status: 'MOCK' }
}

export async function probeAiStatus(): Promise<AiConnectionStatus> {
  const { status } = await resolveAiProvider()
  return status
}
