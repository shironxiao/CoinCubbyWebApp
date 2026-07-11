import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { watch } from 'node:fs'
import { config } from './config.js'

const gpioPath = `/sys/class/gpio/gpio${config.coinPulseGpio}`
const valuePath = `${gpioPath}/value`
let lastPulseAt = 0

async function writeSysfs(path, value) {
  await writeFile(path, value)
}

async function exportGpioIfNeeded() {
  if (!existsSync(gpioPath)) {
    await writeSysfs('/sys/class/gpio/export', String(config.coinPulseGpio))
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

async function configureCoinInput() {
  await exportGpioIfNeeded()
  await writeSysfs(`${gpioPath}/direction`, 'in')
  await writeSysfs(`${gpioPath}/edge`, 'rising')
}

export async function startCoinPulseListener(deviceState, onCoinPulse) {
  try {
    await configureCoinInput()
  } catch (error) {
    deviceState.lastError = `Coin pulse GPIO setup failed: ${error.message}`
    console.error(deviceState.lastError)
    return null
  }

  const watcher = watch(valuePath, async () => {
    const now = Date.now()
    if (now - lastPulseAt < config.coinPulseDebounceMs) return
    lastPulseAt = now

    const value = (await readFile(valuePath, 'utf8')).trim()
    if (value !== '1') return

    await onCoinPulse(config.coinPulseValue)
  })

  console.log(`Coin pulse listener active on GPIO ${config.coinPulseGpio}.`)
  return watcher
}

