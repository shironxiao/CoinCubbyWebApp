import { config } from './config.js'

function headers(extra = {}) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    'x-device-token': config.deviceToken,
    ...extra,
  }
}

async function readResponse(response) {
  const text = await response.text()
  const body = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = body?.error || body?.message || `Request failed (${response.status}).`
    throw new Error(message)
  }

  return body
}

export async function sendHeartbeat() {
  const response = await fetch(`${config.apiBaseUrl}/device-heartbeat`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      device_code: config.deviceCode,
      device_token: config.deviceToken,
      status: 'Online',
    }),
  })

  return readResponse(response)
}

export async function fetchNextCommand() {
  const url = new URL(`${config.apiBaseUrl}/device-next-command`)
  url.searchParams.set('device_code', config.deviceCode)

  const response = await fetch(url, {
    headers: headers(),
  })

  return readResponse(response)
}

export async function markCommandComplete(commandId, result = 'success', errorMessage = '') {
  const response = await fetch(`${config.apiBaseUrl}/device-command-complete`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      device_code: config.deviceCode,
      device_token: config.deviceToken,
      command_id: commandId,
      result,
      error_message: errorMessage,
    }),
  })

  return readResponse(response)
}

export async function reportInsertedPayment(paymentSessionId, amountInserted) {
  const response = await fetch(`${config.apiBaseUrl}/device-payment-progress`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      device_code: config.deviceCode,
      device_token: config.deviceToken,
      payment_session_id: paymentSessionId,
      amount_inserted: amountInserted,
    }),
  })

  return readResponse(response)
}

