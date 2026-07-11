import { config } from './config.js'
import { fetchNextCommand, markCommandComplete, reportInsertedPayment, sendHeartbeat } from './api.js'
import { startCoinPulseListener } from './coinPulse.js'
import { pulseLocker, setupRelays } from './gpio.js'
import { startServer } from './server.js'

const state = {
  online: false,
  lastHeartbeatAt: null,
  lastCommandAt: null,
  lastCommand: null,
  lastError: null,
  activePaymentSessionId: null,
  activePaymentAmountDue: 0,
  activePaymentAmountInserted: 0,
  statusMessage: 'Starting Pi controller...',
  snapshot() {
    return {
      device_code: config.deviceCode,
      online: this.online,
      last_heartbeat_at: this.lastHeartbeatAt,
      last_command_at: this.lastCommandAt,
      last_command: this.lastCommand,
      last_error: this.lastError,
      active_payment_session_id: this.activePaymentSessionId,
      active_payment_amount_due: this.activePaymentAmountDue,
      active_payment_amount_inserted: this.activePaymentAmountInserted,
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
      state.activePaymentSessionId = command.payment_session_id
      state.activePaymentAmountDue = Number(amountDue)
      state.activePaymentAmountInserted = 0
      state.statusMessage = `Locker ${lockerNumber}: pay ${Number(amountDue).toFixed(2)}`
      await markCommandComplete(command.command_id, 'success')
      return
    }

    if (command.command === 'unlock_locker' || command.command === 'release_locker') {
      const pin = await pulseLocker(command.locker_id)
      state.activePaymentSessionId = null
      state.activePaymentAmountDue = 0
      state.activePaymentAmountInserted = 0
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

async function handleCoinPulse(amountInserted) {
  if (!state.activePaymentSessionId) {
    state.statusMessage = `Coin pulse ignored: no active payment session`
    return
  }

  try {
    await reportInsertedPayment(state.activePaymentSessionId, amountInserted)
    state.activePaymentAmountInserted += amountInserted
    state.statusMessage = `Coin accepted: ${amountInserted.toFixed(2)}`
  } catch (error) {
    state.lastError = error.message
    console.error('Coin payment failed:', error.message)
  }
}

async function main() {
  await setupRelays()
  await startCoinPulseListener(state, handleCoinPulse)
  startServer(state)
  heartbeatLoop()
  commandLoop()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
