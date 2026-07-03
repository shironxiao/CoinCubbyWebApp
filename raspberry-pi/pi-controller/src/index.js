import { config } from './config.js'
import { fetchNextCommand, markCommandComplete, sendHeartbeat } from './api.js'
import { pulseLocker, setupRelays } from './gpio.js'
import { startServer } from './server.js'

const state = {
  online: false,
  lastHeartbeatAt: null,
  lastCommandAt: null,
  lastCommand: null,
  lastError: null,
  statusMessage: 'Starting Pi controller...',
  snapshot() {
    return {
      device_code: config.deviceCode,
      online: this.online,
      last_heartbeat_at: this.lastHeartbeatAt,
      last_command_at: this.lastCommandAt,
      last_command: this.lastCommand,
      last_error: this.lastError,
      status_message: this.statusMessage,
    }
  },
}

async function heartbeatLoop() {
  try {
    await sendHeartbeat()
    state.online = true
    state.lastHeartbeatAt = new Date().toISOString()
    state.lastError = null
  } catch (error) {
    state.online = false
    state.lastError = error.message
    console.error('Heartbeat failed:', error.message)
  } finally {
    setTimeout(heartbeatLoop, config.heartbeatMs)
  }
}

async function handleCommand(command) {
  if (!command) {
    state.statusMessage = 'Waiting for rentals...'
    return
  }

  state.lastCommandAt = new Date().toISOString()
  state.lastCommand = command
  state.statusMessage = `Command: ${command.command}`

  try {
    if (command.command === 'display_payment') {
      const amountDue = command.payload?.amount_due || 0
      const lockerNumber = command.payload?.locker_number || command.locker_id
      state.statusMessage = `Locker ${lockerNumber}: pay ${Number(amountDue).toFixed(2)}`
      await markCommandComplete(command.command_id, 'success')
      return
    }

    if (command.command === 'unlock_locker' || command.command === 'release_locker') {
      const pin = await pulseLocker(command.locker_id)
      state.statusMessage = `Locker ${command.locker_id} opened on GPIO ${pin}`
      await markCommandComplete(command.command_id, 'success')
      return
    }

    if (command.command === 'lock_locker' || command.command === 'cancel_payment') {
      state.statusMessage = `Completed ${command.command}`
      await markCommandComplete(command.command_id, 'success')
      return
    }

    throw new Error(`Unsupported command: ${command.command}`)
  } catch (error) {
    state.lastError = error.message
    await markCommandComplete(command.command_id, 'failed', error.message)
  }
}

async function commandLoop() {
  try {
    const command = await fetchNextCommand()
    await handleCommand(command)
  } catch (error) {
    state.lastError = error.message
    console.error('Command polling failed:', error.message)
  } finally {
    setTimeout(commandLoop, config.commandPollMs)
  }
}

async function main() {
  await setupRelays()
  startServer(state)
  heartbeatLoop()
  commandLoop()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
