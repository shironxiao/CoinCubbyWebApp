import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { config } from './config.js'

const execFileAsync = promisify(execFile)
const outputValue = config.relayActiveHigh ? 'dh' : 'dl'
const idleValue = config.relayActiveHigh ? 'dl' : 'dh'

async function runGpio(args) {
  try {
    await execFileAsync('pinctrl', args)
    return
  } catch {
    await execFileAsync('raspi-gpio', args)
  }
}

export function relayPinForLocker(lockerId) {
  return config.relayPins[Number(lockerId)] || null
}

export async function setupRelays() {
  for (const pin of Object.values(config.relayPins)) {
    await runGpio(['set', String(pin), 'op'])
    await runGpio(['set', String(pin), idleValue])
  }
}

export async function pulseLocker(lockerId) {
  const pin = relayPinForLocker(lockerId)
  if (!pin) throw new Error(`No relay GPIO configured for locker ${lockerId}.`)

  await runGpio(['set', String(pin), outputValue])
  await new Promise((resolve) => setTimeout(resolve, config.relayPulseMs))
  await runGpio(['set', String(pin), idleValue])

  return pin
}
