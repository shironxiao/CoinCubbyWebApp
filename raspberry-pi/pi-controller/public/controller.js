const statusText = document.querySelector('#statusText')
const deviceCode = document.querySelector('#deviceCode')
const lastCommand = document.querySelector('#lastCommand')
const lastError = document.querySelector('#lastError')
const testButton = document.querySelector('#testButton')
const lockerInput = document.querySelector('#lockerInput')

async function refreshStatus() {
  try {
    const response = await fetch('/api/status')
    const status = await response.json()

    statusText.textContent = status.status_message || 'Waiting...'
    deviceCode.textContent = status.device_code || '-'
    lastCommand.textContent = status.last_command?.command || '-'
    lastError.textContent = status.last_error || 'None'
  } catch {
    statusText.textContent = 'Controller offline'
    lastError.textContent = 'Could not reach local Pi service'
  }
}

document.querySelector('#refreshButton').addEventListener('click', refreshStatus)

testButton.addEventListener('click', async () => {
  const lockerId = Number(lockerInput.value || 1)
  statusText.textContent = `Opening locker ${lockerId}...`

  const response = await fetch('/api/test-unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locker_id: lockerId }),
  })

  const result = await response.json()
  statusText.textContent = result.ok ? `Locker ${lockerId} opened` : result.error
})

refreshStatus()
setInterval(refreshStatus, 1000)
