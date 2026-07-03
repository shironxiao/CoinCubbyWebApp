import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile()

function boolFromEnv(name, fallback) {
  const value = process.env[name]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

export const config = {
  port: numberFromEnv('PORT', 4177),
  apiBaseUrl: process.env.API_BASE_URL || 'https://cjuimxgxovdmijuenagr.supabase.co/functions/v1',
  anonKey: process.env.SUPABASE_ANON_KEY || 'sb_publishable_YthaUzaLsciMAsHKqzVqnw_g_Whatd1',
  deviceCode: process.env.DEVICE_CODE || 'DEVICE001',
  deviceToken: process.env.DEVICE_TOKEN || 'change-me',
  relayActiveHigh: boolFromEnv('RELAY_ACTIVE_HIGH', true),
  relayPulseMs: numberFromEnv('RELAY_PULSE_MS', 1200),
  commandPollMs: numberFromEnv('COMMAND_POLL_MS', 2000),
  heartbeatMs: numberFromEnv('HEARTBEAT_MS', 15000),
  relayPins: {
    1: numberFromEnv('LOCKER_1_GPIO', 26),
    2: numberFromEnv('LOCKER_2_GPIO', 27),
    3: numberFromEnv('LOCKER_3_GPIO', 22),
    4: numberFromEnv('LOCKER_4_GPIO', 23),
    5: numberFromEnv('LOCKER_5_GPIO', 24),
    6: numberFromEnv('LOCKER_6_GPIO', 25),
    7: numberFromEnv('LOCKER_7_GPIO', 5),
    8: numberFromEnv('LOCKER_8_GPIO', 6),
    9: numberFromEnv('LOCKER_9_GPIO', 12),
    10: numberFromEnv('LOCKER_10_GPIO', 13),
    11: numberFromEnv('LOCKER_11_GPIO', 16),
    12: numberFromEnv('LOCKER_12_GPIO', 17),
    13: numberFromEnv('LOCKER_13_GPIO', 18),
    14: numberFromEnv('LOCKER_14_GPIO', 19),
    15: numberFromEnv('LOCKER_15_GPIO', 20),
    16: numberFromEnv('LOCKER_16_GPIO', 21),
  },
}

