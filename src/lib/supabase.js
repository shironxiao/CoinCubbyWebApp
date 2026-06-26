const SUPABASE_URL = 'https://cjuimxgxovdmijuenagr.supabase.co'
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdWlteGd4b3ZkbWlqdWVuYWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzQ0OTEsImV4cCI6MjA5MjAxMDQ5MX0.t6ixuFiD2iYzrNZsc1QjG3gpdTdBuMY37qTKzwxdg18'

export const storageKey = 'coincubby.session'

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || null
  } catch {
    return null
  }
}

export function saveSession(session) {
  localStorage.setItem(storageKey, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(storageKey)
}

function authHeaders(token, extra = {}) {
  return {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${token || SUPABASE_ANON}`,
    ...extra,
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, options)
  const text = await response.text()
  const body = text ? parseBody(text) : null

  if (!response.ok) {
    const message =
      body?.error_description || body?.msg || body?.message || body?.error || `Request failed (${response.status}).`

    // Auto-logout if token is expired or invalid
    if (
      message.includes('JWT') ||
      message.includes('token is expired') ||
      message.includes('invalid claim')
    ) {
      clearSession()
      if (typeof window !== 'undefined') {
        window.location.hash = '/login'
      }
    }
    throw new Error(message)
  }

  return body
}

function parseBody(text) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function customerNameFromSession(session) {
  const fallbackName = session?.email?.split('@')[0] || session?.userId?.slice(0, 8) || 'Customer'
  return String(session?.fullName || fallbackName).trim().slice(0, 50)
}

export async function loginWithPassword(email, password) {
  const body = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: authHeaders(null, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email, password }),
  })

  const user = body.user || {}
  const fullName = user.user_metadata?.full_name || ''
  const session = {
    accessToken: body.access_token,
    userId: user.id || '',
    fullName,
    email: user.email || email,
  }

  saveSession(session)
  return session
}

export async function registerAccount({ firstName, lastName, email, password, passkey }) {
  const fullName = `${firstName} ${lastName}`.trim()
  const body = await request('/auth/v1/signup', {
    method: 'POST',
    headers: authHeaders(null, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      email,
      password,
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
      },
    }),
  })

  const userId = body.id || body.user?.id || ''
  const token = body.access_token || body.session?.access_token || SUPABASE_ANON

  if (userId) {
    const hashed = await hashPasskey(passkey)
    await request('/rest/v1/customers', {
      method: 'POST',
      headers: authHeaders(token, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({
        customer_id: userId,
        full_name: fullName.slice(0, 50),
        email,
        passkey: hashed,
      }),
    })
  }

  return body
}

export async function logout(token) {
  try {
    await request('/auth/v1/logout', {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: '',
    })
  } finally {
    clearSession()
  }
}

export async function changePassword(password, token) {
  return request('/auth/v1/user', {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ password }),
  })
}

export async function sendPasswordResetEmail(email) {
  const url = `${SUPABASE_URL}/auth/v1/recover?apikey=${encodeURIComponent(SUPABASE_ANON)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({ email }),
  })

  const text = await response.text()
  const body = text ? parseBody(text) : null

  if (!response.ok) {
    const message =
      body?.error_description || body?.msg || body?.message || body?.error || `Password reset failed (${response.status}).`
    throw new Error(message)
  }

  return body
}



export function sizeFromType(sizeTypeId) {
  if (Number(sizeTypeId) === 2) return { label: 'Medium', rate: 20, price_per_minute: 20 / 60 }
  if (Number(sizeTypeId) === 3) return { label: 'Large', rate: 30, price_per_minute: 30 / 60 }
  return { label: 'Small', rate: 10, price_per_minute: 10 / 60 }
}

export async function fetchModules() {
  return request(
    '/rest/v1/modules?select=module_id,name,status&status=eq.Active&order=module_id.asc',
    { headers: authHeaders() },
  )
}

export async function fetchLockers(moduleId) {
  const moduleFilter = moduleId ? `module_id=eq.${moduleId}&` : ''
  const rows = await request(
    `/rest/v1/lockers?${moduleFilter}select=locker_id,locker_number,status,size_type_id,module_id&order=locker_id.asc`,
    { headers: authHeaders() },
  )

  return (rows || []).map((row) => {
    const size = sizeFromType(row.size_type_id)
    return {
      dbId: row.locker_id,
      id: row.locker_number || String(row.locker_id),
      status: row.status || 'Available',
      size: size.label,
      rate: size.rate,
      sizeTypeId: row.size_type_id,
      moduleId: row.module_id,
    }
  })
}

export async function fetchRates() {
  return request('/rest/v1/rates?select=rate_id,size_type_id,price_per_minute,min_charge_minutes', {
    headers: authHeaders(),
  })
}

export async function upsertCustomer(session) {
  if (!session?.userId) return

  await request('/rest/v1/customers?on_conflict=customer_id', {
    method: 'POST',
    headers: authHeaders(session.accessToken, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify({
      customer_id: session.userId,
      full_name: customerNameFromSession(session),
      email: session.email || '',
    }),
  })
}

export async function createRental({ locker, duration, isOpenTime, paymentMethod, session }) {
  // Make customer upsert non-fatal so that existing customer accounts don't block the rental
  try {
    await upsertCustomer(session)
  } catch (err) {
    console.warn('Customer upsert warning (continuing):', err)
  }

  const rates = await fetchRates()
  const sizeTypeId = locker.sizeTypeId || (locker.size === 'Medium' ? 2 : locker.size === 'Large' ? 3 : 1)
  const rate = (rates || []).find((item) => Number(item.size_type_id) === Number(sizeTypeId))

  if (!rate) throw new Error(`Rate not found for ${locker.size}.`)

  const now = new Date()

  // Generate a globally unique 6-digit PIN for this transaction
  const qrToken = await generateUniquePin()

  const isDevicePending = !isOpenTime && paymentMethod === 'Device'

  const body = {
    customer_id: session.userId,
    rate_id: rate.rate_id,
    locker_id: locker.dbId,
    start_time: now.toISOString(),
    status: isDevicePending ? 'PaymentPending' : 'Active',
    qr_token: qrToken,
  }

  if (!isOpenTime) {
    const hours = Number(duration)
    body.duration_minutes = hours * 60
    body.end_time = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString()
  }

  const transactionRows = await request('/rest/v1/transactions?select=transaction_id', {
    method: 'POST',
    headers: authHeaders(session.accessToken, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(body),
  })

  const transactionId = transactionRows?.[0]?.transaction_id
  const amount = isOpenTime ? 0 : Number(duration) * locker.rate

  if (transactionId && !isDevicePending) {
    const payment = {
      transaction_id: transactionId,
      amount,
    }
    if (!isOpenTime && paymentMethod === 'Wallet') payment.payment_method = 'Wallet'

    await request('/rest/v1/payments', {
      method: 'POST',
      headers: authHeaders(session.accessToken, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify(payment),
    })
  }

  const initialLockerStatus = isDevicePending ? 'Payment Required' : 'Occupied'
  await updateLockerStatus(locker.dbId, initialLockerStatus, session.accessToken)
  return { transactionId, qrToken }
}

export async function fetchTransactionPayments(transactionId, token) {
  return request(`/rest/v1/payments?transaction_id=eq.${transactionId}&select=amount,payment_method`, {
    headers: authHeaders(token),
  })
}

export async function activateRental(transactionId, lockerId, token) {
  await request(`/rest/v1/transactions?transaction_id=eq.${transactionId}`, {
    method: 'PATCH',
    headers: authHeaders(token, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({ status: 'Active' }),
  })
  await updateLockerStatus(lockerId, 'Occupied', token)
}

export async function updateLockerStatus(lockerId, status, token) {
  return request(`/rest/v1/lockers?locker_id=eq.${lockerId}`, {
    method: 'PATCH',
    headers: authHeaders(token, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({ status }),
  })
}

export async function fetchProfile(session) {
  const user = await request('/auth/v1/user', {
    headers: authHeaders(session?.accessToken),
  })

  const customers = await request(
    `/rest/v1/customers?customer_id=eq.${user.id}&select=customer_id,full_name,email,passkey`,
    { headers: authHeaders(session?.accessToken, { Accept: 'application/json' }) },
  )

  console.log('API fetchProfile result:', { user, customer: customers?.[0] })

  return {
    user,
    customer: customers?.[0] || null,
  }
}

export async function fetchActiveRentals(customerId, token) {
  return request(
    `/rest/v1/transactions?customer_id=eq.${customerId}&status=eq.Active&select=transaction_id,locker_id,start_time,end_time,duration_minutes,qr_token,status,lockers(locker_number,size_type_id),rates(price_per_minute,min_charge_minutes)&order=start_time.desc`,
    { headers: authHeaders(token) },
  )
}

export async function fetchRentalHistory(customerId, token) {
  return request(
    `/rest/v1/transactions?customer_id=eq.${customerId}&select=transaction_id,locker_id,start_time,end_time,duration_minutes,qr_token,status,lockers(locker_number,size_type_id),payments(amount,payment_method)&order=start_time.desc`,
    { headers: authHeaders(token) },
  )
}

export async function completeRental(item, token, overtimeFee = 0, paymentMethod = 'Device') {
  const now = new Date()
  
  const totalDurationMinutes = Math.max(
    item.durationMinutes || 60,
    Math.floor((now.getTime() - item.startMs) / 60000)
  )

  await request(`/rest/v1/transactions?transaction_id=eq.${item.transactionId}`, {
    method: 'PATCH',
    headers: authHeaders(token, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({
      status: 'Completed',
      end_time: now.toISOString(),
      duration_minutes: totalDurationMinutes,
    }),
  })

  // Calculate refund for early return on fixed-duration rentals (all payment methods)
  if (!item.isOpenTime && item.endMs && item.userId) {
    const currentTime = now.getTime()
    if (currentTime < item.endMs) {
      const unusedMs = item.endMs - currentTime
      const unusedMinutes = Math.floor(unusedMs / 60000)
      const refundAmount = Number((unusedMinutes * (item.ratePerHr / 60)).toFixed(2))

      if (refundAmount > 0) {
        // 1. Credit the user's digital wallet in localStorage
        const balanceKey = `coincubby.balance.${item.userId}`
        const currentBalance = Number(localStorage.getItem(balanceKey) || 50.0)
        const newBalance = currentBalance + refundAmount
        localStorage.setItem(balanceKey, newBalance.toFixed(2))

        // 2. Insert a negative payment record in the database
        try {
          await request('/rest/v1/payments', {
            method: 'POST',
            headers: authHeaders(token, {
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            }),
            body: JSON.stringify({
              transaction_id: item.transactionId,
              amount: -refundAmount,
              payment_method: 'Wallet',
            }),
          })
        } catch (err) {
          console.error('Failed to log database refund payment:', err)
        }
      }
    }
  }

  let finalPaymentAmount = overtimeFee
  if (finalPaymentAmount <= 0 && item.isOpenTime) {
    finalPaymentAmount = (totalDurationMinutes / 60) * item.ratePerHr
  }

  if (finalPaymentAmount > 0) {
    await request('/rest/v1/payments', {
      method: 'POST',
      headers: authHeaders(token, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({
        transaction_id: item.transactionId,
        amount: finalPaymentAmount,
        payment_method: paymentMethod,
      }),
    })
  }

  await updateLockerStatus(item.lockerId, 'Available', token)
}

export function privateKeyFor(userId) {
  if (!userId) return '-'
  return `COIN-${userId.slice(0, 8).toUpperCase()}`
}

/**
 * Generates a globally unique 6-digit numeric PIN for a locker transaction.
 * Retries up to 10 times if the generated PIN already exists in the DB.
 */
async function generateUniquePin(retries = 10) {
  for (let i = 0; i < retries; i++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000))
    const existing = await request(
      `/rest/v1/transactions?qr_token=eq.${pin}&select=transaction_id&limit=1`,
      { headers: authHeaders() },
    ).catch(() => null)
    if (!existing || existing.length === 0) return pin
  }
  // Fallback: timestamp-based 6-digit suffix (extremely unlikely collision)
  return String(Date.now()).slice(-6)
}

export function parseTimestamp(value) {
  if (!value) return -1
  let str = String(value)
  // If the timestamp doesn't end with Z and doesn't contain a + or - offset,
  // append 'Z' to force JavaScript to parse it as a UTC timestamp (since PostgreSQL's 
  // 'timestamp without time zone' drops the timezone suffix)
  if (!str.endsWith('Z') && !str.includes('+') && !/-\d{2}:\d{2}$/.test(str)) {
    str += 'Z'
  }
  const time = new Date(str).getTime()
  return Number.isNaN(time) ? -1 : time
}

export function formatMoney(value) {
  return `₱${Number(value || 0).toFixed(2)}`
}

export async function verifyUserPassword(email, password) {
  await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: authHeaders(null, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email, password }),
  })
  return true
}

export async function hashPasskey(passkey) {
  if (!passkey) return ''
  const encoder = new TextEncoder()
  const data = encoder.encode(passkey)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function recoverPasskey(hash) {
  if (!hash || hash.length !== 64) return ''
  for (let i = 0; i <= 9999; i++) {
    const pin = String(i).padStart(4, '0')
    const hashed = await hashPasskey(pin)
    if (hashed === hash) {
      return pin
    }
  }
  return ''
}

export async function isPasskeyTaken(passkey) {
  const hashed = await hashPasskey(passkey)
  const existing = await request(
    `/rest/v1/customers?passkey=eq.${hashed}&select=customer_id&limit=1`,
    { headers: authHeaders() }
  ).catch(() => null)
  return !!(existing && existing.length > 0)
}

export async function updatePasskey(customerId, passkey, token) {
  const hashed = await hashPasskey(passkey)
  return request(`/rest/v1/customers?customer_id=eq.${customerId}`, {
    method: 'PATCH',
    headers: authHeaders(token, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({ passkey: hashed }),
  })
}

export async function verifyPasskey(userId, enteredPin, token) {
  const hashed = await hashPasskey(enteredPin)
  const rows = await request(
    `/rest/v1/customers?customer_id=eq.${userId}&select=passkey&limit=1`,
    { headers: authHeaders(token, { Accept: 'application/json' }) }
  ).catch(() => null)
  if (!rows || rows.length === 0) return false
  if (!rows[0].passkey) return true
  return rows[0].passkey === hashed
}
