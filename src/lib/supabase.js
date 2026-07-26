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

export async function validateSession(session) {
  if (!session?.accessToken) return false
  try {
    await request('/auth/v1/user', {
      headers: authHeaders(session.accessToken),
    })
    return true
  } catch {
    clearSession()
    return false
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

export async function registerAccount({ firstName, lastName, email, password, userId }) {
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

  const customerId = body.id || body.user?.id || ''
  const token = body.access_token || body.session?.access_token || SUPABASE_ANON

  if (customerId) {
    await request('/rest/v1/customers', {
      method: 'POST',
      headers: authHeaders(token, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({
        customer_id: customerId,
        full_name: fullName.slice(0, 50),
        email,
        user_id: userId,
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



// In-memory rates cache so we don't re-fetch on every call
let _ratesCache = null
let _ratesCacheTime = 0
const RATES_CACHE_TTL = 60_000 // 1 minute

/**
 * Fetches rates from the database and returns a Map keyed by size_type_id.
 * Caches in memory for 1 minute to avoid excessive API calls.
 */
export async function fetchRatesMap(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && _ratesCache && now - _ratesCacheTime < RATES_CACHE_TTL) {
    return _ratesCache
  }

  try {
    const rates = await fetchRates()
    const map = {}
    for (const r of rates || []) {
      map[Number(r.size_type_id)] = Number(r.price_per_hour)
    }
    _ratesCache = map
    _ratesCacheTime = now
    return map
  } catch (err) {
    console.warn('Failed to fetch rates from DB, using cache/fallback:', err)
    return _ratesCache || {}
  }
}

/** Clears the in-memory rates cache (useful after admin updates). */
export function invalidateRatesCache() {
  _ratesCache = null
  _ratesCacheTime = 0
}

const SIZE_LABELS = { 1: 'Small', 2: 'Medium', 3: 'Large' }
const FALLBACK_RATES = { 1: 10, 2: 20, 3: 30 }

/**
 * Returns size info for a given size_type_id.
 * If a ratesMap (from fetchRatesMap) is provided, uses DB rates.
 * Otherwise falls back to hardcoded defaults.
 */
export function sizeFromType(sizeTypeId, ratesMap) {
  const id = Number(sizeTypeId) || 1
  const label = SIZE_LABELS[id] || 'Small'
  const activeMap = ratesMap || _ratesCache
  const rate = (activeMap && activeMap[id] != null) ? Number(activeMap[id]) : (FALLBACK_RATES[id] || 10)
  return { label, rate, price_per_minute: rate / 60 }
}

export async function fetchModules() {
  return request(
    '/rest/v1/modules?select=module_id,name,status&status=eq.Active&order=module_id.asc',
    { headers: authHeaders() },
  )
}

export async function fetchLockers(moduleId) {
  const moduleFilter = moduleId ? `module_id=eq.${moduleId}&` : ''
  const [rows, ratesMap] = await Promise.all([
    request(
      `/rest/v1/lockers?${moduleFilter}select=locker_id,locker_number,status,size_type_id,module_id,device_id&order=locker_id.asc`,
      { headers: authHeaders() },
    ),
    fetchRatesMap(),
  ])

  return (rows || []).map((row) => {
    const size = sizeFromType(row.size_type_id, ratesMap)
    return {
      dbId: row.locker_id,
      id: row.locker_number || String(row.locker_id),
      status: row.status || 'Available',
      size: size.label,
      rate: size.rate,
      sizeTypeId: row.size_type_id,
      moduleId: row.module_id,
      deviceId: row.device_id,
    }
  })
}

export async function fetchRates() {
  return request('/rest/v1/rates?select=rate_id,size_type_id,price_per_hour', {
    headers: authHeaders(),
  })
}

// ensureCorrectRates() was removed — rates are now fully driven by the database.
// Admin rate changes in the rates table are reflected in real-time.

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
  const amount = isOpenTime ? 0 : Number(duration) * Number(rate.price_per_hour)

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

  let paymentSession = null
  if (transactionId && isDevicePending) {
    paymentSession = await createPaymentSession({
      transactionId,
      customerId: session.userId,
      lockerId: locker.dbId,
      deviceId: locker.deviceId,
      sessionType: 'rental_payment',
      amountDue: amount,
      token: session.accessToken,
    })

    await createDeviceCommand({
      deviceId: paymentSession.device_id,
      lockerId: locker.dbId,
      transactionId,
      paymentSessionId: paymentSession.payment_session_id,
      command: 'display_payment',
      payload: {
        amount_due: amount,
        locker_number: locker.id,
      },
      token: session.accessToken,
    })
  } else if (transactionId) {
    await createDeviceCommand({
      deviceId: locker.deviceId,
      lockerId: locker.dbId,
      transactionId,
      command: 'unlock_locker',
      payload: {
        locker_number: locker.id,
      },
      token: session.accessToken,
    })
  }

  return { transactionId, qrToken, paymentSession }
}

export async function fetchDefaultDevice(token) {
  try {
    const rows = await request('/rest/v1/devices?select=device_id,device_code&order=device_id.asc&limit=1', {
      headers: authHeaders(token),
    })
    return rows?.[0] || null
  } catch {
    return null
  }
}

export async function resolveDeviceId(deviceId, token) {
  if (deviceId) return deviceId
  const device = await fetchDefaultDevice(token)
  return device?.device_id || null
}

export async function createPaymentSession({
  transactionId,
  customerId,
  lockerId,
  deviceId,
  sessionType,
  amountDue,
  token,
}) {
  try {
    const resolvedDeviceId = await resolveDeviceId(deviceId, token)
    if (!resolvedDeviceId) {
      console.warn('No locker device configured in DB; returning mock payment session.')
      return {
        payment_session_id: `mock-${Date.now()}`,
        device_id: null,
        amount_due: Number(amountDue || 0).toFixed(2),
        amount_paid: 0,
        status: 'Pending',
      }
    }

    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString()

    const rows = await request('/rest/v1/payment_sessions?select=payment_session_id,device_id,amount_due,amount_paid,status', {
      method: 'POST',
      headers: authHeaders(token, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify({
        transaction_id: transactionId,
        customer_id: customerId,
        locker_id: lockerId,
        device_id: resolvedDeviceId,
        session_type: sessionType,
        amount_due: Number(amountDue || 0).toFixed(2),
        amount_paid: 0,
        status: 'Pending',
        expires_at: expiresAt,
      }),
    })

    return rows?.[0] || null
  } catch (err) {
    console.warn('Payment session creation failed (using fallback mock session):', err)
    return {
      payment_session_id: `mock-${Date.now()}`,
      device_id: null,
      amount_due: Number(amountDue || 0).toFixed(2),
      amount_paid: 0,
      status: 'Pending',
    }
  }
}

export async function fetchPaymentSession(paymentSessionId, token) {
  if (!paymentSessionId || String(paymentSessionId).startsWith('mock-')) return null
  try {
    const rows = await request(
      `/rest/v1/payment_sessions?payment_session_id=eq.${paymentSessionId}&select=payment_session_id,amount_due,amount_paid,status`,
      { headers: authHeaders(token) },
    )
    return rows?.[0] || null
  } catch {
    return null
  }
}

export async function cancelPaymentSession(paymentSessionId, token) {
  if (!paymentSessionId || String(paymentSessionId).startsWith('mock-')) return
  try {
    return await request(`/rest/v1/payment_sessions?payment_session_id=eq.${paymentSessionId}`, {
      method: 'PATCH',
      headers: authHeaders(token, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({ status: 'Cancelled', updated_at: new Date().toISOString() }),
    })
  } catch {
    return null
  }
}

export async function createDeviceCommand({
  deviceId,
  lockerId,
  transactionId,
  paymentSessionId = null,
  command,
  payload = {},
  token,
}) {
  try {
    const resolvedDeviceId = await resolveDeviceId(deviceId, token)
    if (!resolvedDeviceId) {
      console.warn('No locker device configured in DB; skipping device command:', command)
      return null
    }

    const rows = await request('/rest/v1/device_commands?select=command_id', {
      method: 'POST',
      headers: authHeaders(token, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify({
        device_id: resolvedDeviceId,
        locker_id: lockerId,
        transaction_id: transactionId,
        payment_session_id: paymentSessionId,
        command,
        payload,
        status: 'Pending',
      }),
    })

    return rows?.[0] || null
  } catch (err) {
    console.warn('Device command creation failed (continuing):', err)
    return null
  }
}

export async function createReturnPaymentSession(item, token, amountDue) {
  try {
    const paymentSession = await createPaymentSession({
      transactionId: item.transactionId,
      customerId: item.userId,
      lockerId: item.lockerId,
      deviceId: item.deviceId,
      sessionType: 'overtime_payment',
      amountDue,
      token,
    })

    if (paymentSession?.device_id) {
      await createDeviceCommand({
        deviceId: paymentSession.device_id,
        lockerId: item.lockerId,
        transactionId: item.transactionId,
        paymentSessionId: paymentSession.payment_session_id,
        command: 'display_payment',
        payload: {
          amount_due: amountDue,
          locker_number: item.lockerNumber,
        },
        token,
      })
    }

    return paymentSession
  } catch (err) {
    console.warn('Create return payment session failed (continuing):', err)
    return null
  }
}

export async function fetchTransactionPayments(transactionId, token) {
  return request(`/rest/v1/payments?transaction_id=eq.${transactionId}&select=amount,payment_method,change_amount`, {
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

  let customers = await request(
    `/rest/v1/customers?customer_id=eq.${user.id}&select=customer_id,full_name,email,user_id`,
    { headers: authHeaders(session?.accessToken, { Accept: 'application/json' }) },
  )

  let customer = customers?.[0] || null

  // Self-heal: If customer row is missing, or user_id is missing or invalid, generate and save it
  if (!customer || !customer.user_id || !/^\d{6}$/.test(customer.user_id)) {
    try {
      const newUserId = await generateUniqueUserId()
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      const email = user.email || ''

      const body = {
        customer_id: user.id,
        full_name: fullName.slice(0, 50),
        email: email,
        user_id: newUserId,
      }

      await request('/rest/v1/customers?on_conflict=customer_id', {
        method: 'POST',
        headers: authHeaders(session?.accessToken, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify(body),
      })

      // Fetch the fresh row to ensure UI displays it immediately
      const updatedCustomers = await request(
        `/rest/v1/customers?customer_id=eq.${user.id}&select=customer_id,full_name,email,user_id`,
        { headers: authHeaders(session?.accessToken, { Accept: 'application/json' }) },
      )
      if (updatedCustomers && updatedCustomers.length > 0) {
        customer = updatedCustomers[0]
      }
    } catch (err) {
      console.error('Failed to auto-heal missing customer user_id:', err)
    }
  }

  console.log('API fetchProfile result:', { user, customer })

  return {
    user,
    customer,
  }
}

export async function fetchActiveRentals(customerId, token) {
  return request(
    `/rest/v1/transactions?customer_id=eq.${customerId}&status=eq.Active&select=transaction_id,locker_id,start_time,end_time,duration_minutes,qr_token,status,lockers(locker_number,size_type_id,device_id),rates(price_per_hour)&order=start_time.desc`,
    { headers: authHeaders(token) },
  )
}

export async function fetchRentalHistory(customerId, token) {
  return request(
    `/rest/v1/transactions?customer_id=eq.${customerId}&select=transaction_id,locker_id,start_time,end_time,duration_minutes,qr_token,status,lockers(locker_number,size_type_id),payments(amount,payment_method,change_amount)&order=start_time.desc`,
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
        // 1. Credit the user's wallet using the stored RPC function (bypasses RLS)
        try {
          const result = await request('/rest/v1/rpc/add_wallet_balance', {
            method: 'POST',
            headers: authHeaders(token, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              p_customer_id: item.userId,
              p_amount: refundAmount
            })
          })
          const newBalance = Number(result)
          localStorage.setItem(`coincubby.balance.${item.userId}`, newBalance.toFixed(2))
        } catch (err) {
          console.error('Failed to add refund to wallet via RPC:', err)
        }

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
    const hours = Math.floor(totalDurationMinutes / 60)
    const rem = totalDurationMinutes % 60
    let multiplier = hours
    if (rem > 0) {
      if (rem <= 30) {
        multiplier += 0.5
      } else {
        multiplier += 1.0
      }
    }
    finalPaymentAmount = Math.floor(multiplier * item.ratePerHr)
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

    // Deduct from DB wallet via RPC if overtime fee is paid via Wallet
    if (paymentMethod === 'Wallet' && item.userId) {
      try {
        const result = await request('/rest/v1/rpc/deduct_wallet_balance', {
          method: 'POST',
          headers: authHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            p_customer_id: item.userId,
            p_amount: finalPaymentAmount
          })
        })
        const newBalance = Number(result)
        localStorage.setItem(`coincubby.balance.${item.userId}`, newBalance.toFixed(2))
      } catch (err) {
        console.error('Failed to deduct wallet via RPC for overtime:', err)
      }
    }
  }

  await updateLockerStatus(item.lockerId, 'Available', token)

  await createDeviceCommand({
    deviceId: item.deviceId,
    lockerId: item.lockerId,
    transactionId: item.transactionId,
    command: 'release_locker',
    payload: {
      locker_number: item.lockerNumber,
    },
    token,
  })
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

export function formatMoney(value, includeCentavos = true) {
  if (!includeCentavos) {
    return `₱${Math.floor(Number(value || 0))}`
  }
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

/**
 * Verifies the user's 6-digit PIN by re-authenticating against Supabase Auth.
 * Used for locker return security verification.
 */
export async function verifyPinAsPassword(email, pin) {
  return verifyUserPassword(email, pin)
}

/**
 * Checks if a 6-digit User ID is already taken in the customers table.
 */
export async function isUserIdTaken(userId) {
  const existing = await request(
    `/rest/v1/customers?user_id=eq.${userId}&select=customer_id&limit=1`,
    { headers: authHeaders() },
  ).catch(() => null)
  return !!(existing && existing.length > 0)
}

/**
 * Generates a globally unique 6-digit numeric User ID.
 * Retries up to 10 times on collision.
 */
export async function generateUniqueUserId(retries = 10) {
  for (let i = 0; i < retries; i++) {
    const id = String(Math.floor(100000 + Math.random() * 900000))
    const taken = await isUserIdTaken(id)
    if (!taken) return id
  }
  // Fallback: timestamp-based suffix (extremely unlikely collision)
  return String(Date.now()).slice(-6)
}

export async function getOrCreateWallet(session) {
  if (!session?.userId) return null
  try {
    const data = await request(`/rest/v1/wallets?customer_id=eq.${session.userId}&select=balance`, {
      headers: authHeaders(session.accessToken)
    })
    if (data && data.length > 0) {
      const balance = Number(data[0].balance)
      localStorage.setItem(`coincubby.balance.${session.userId}`, balance.toFixed(2))
      return balance
    }
  } catch (err) {
    console.warn('Failed to fetch wallet from database, trying to create one:', err)
  }

  try {
    // Read from localStorage to check if there is an existing balance from an old account
    const cached = localStorage.getItem(`coincubby.balance.${session.userId}`)
    const initialBalance = cached !== null && !Number.isNaN(Number(cached)) ? Number(cached) : 50.00

    await request('/rest/v1/wallets?on_conflict=customer_id', {
      method: 'POST',
      headers: authHeaders(session.accessToken, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify({
        customer_id: session.userId,
        balance: initialBalance
      })
    })
    localStorage.setItem(`coincubby.balance.${session.userId}`, initialBalance.toFixed(2))
    return initialBalance
  } catch (err) {
    console.error('Failed to create default wallet in database:', err)
    const cached = localStorage.getItem(`coincubby.balance.${session.userId}`)
    return cached !== null ? Number(cached) : 50.00
  }
}

/**
 * Syncs wallet balance to database using the stored RPC function (bypasses RLS).
 * Also updates localStorage cache.
 */
export async function syncWalletBalance(session, newBalance) {
  if (!session?.userId) return
  localStorage.setItem(`coincubby.balance.${session.userId}`, Number(newBalance).toFixed(2))
  try {
    // Compute the delta between current cached balance and the new balance
    const cached = Number(localStorage.getItem(`coincubby.balance.${session.userId}`) || newBalance)
    const delta = newBalance - cached
    if (delta > 0) {
      await request('/rest/v1/rpc/add_wallet_balance', {
        method: 'POST',
        headers: authHeaders(session.accessToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ p_customer_id: session.userId, p_amount: delta })
      })
    } else if (delta < 0) {
      await request('/rest/v1/rpc/deduct_wallet_balance', {
        method: 'POST',
        headers: authHeaders(session.accessToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ p_customer_id: session.userId, p_amount: Math.abs(delta) })
      })
    }
  } catch (err) {
    console.error('Failed to sync wallet balance to database via RPC:', err)
  }
}

export function mapRental(row) {
  const size = sizeFromType(row.lockers?.size_type_id)
  const startMs = parseTimestamp(row.start_time)
  const endMs = parseTimestamp(row.end_time)
  const isOpenTime = !row.end_time
  const ratePerHr = row.rates?.price_per_hour != null ? Number(row.rates.price_per_hour) : size.rate

  return {
    transactionId: row.transaction_id,
    lockerId: row.locker_id,
    lockerNumber: row.lockers?.locker_number || '?',
    deviceId: row.lockers?.device_id,
    sizeName: size.label,
    startMs,
    endMs,
    isOpenTime,
    ratePerHr,
    qrToken: row.qr_token || '-',
    durationMinutes: row.duration_minutes || 0,
  }
}

export function mapHistory(row) {
  const payments = row.payments || []
  const amount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const totalChange = payments.reduce((sum, payment) => sum + Number(payment.change_amount || 0), 0)
  const size = sizeFromType(row.lockers?.size_type_id)

  return {
    id: row.transaction_id,
    lockerNumber: row.lockers?.locker_number || '?',
    sizeName: size.label,
    amount,
    totalChange,
    paymentMethod: payments[0]?.payment_method || 'Device',
    status: row.status || 'Active',
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes || 0,
    paymentsList: payments,
  }
}

/**
 * Submits a star rating + optional comment for a completed transaction.
 * Table: public.feedback (feedback_id, transaction_id, customer_id, rating, comment, created_at)
 * - transaction_id and customer_id are required (FK constraints).
 * - rating must be 1–5 (DB check constraint).
 * - comment is optional.
 */
export async function submitFeedback({ transactionId = null, customerId, rating, comment, token }) {
  return request('/rest/v1/feedback', {
    method: 'POST',
    headers: authHeaders(token, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({
      transaction_id: transactionId || null,
      customer_id: customerId,
      rating: Number(rating),
      comment: comment?.trim() || null,
    }),
  })
}

/**
 * Fetches all feedback rows submitted by the current customer.
 * Also joins the transaction so we can show the locker number.
 */
export async function fetchUserFeedback(customerId, token) {
  return request(
    `/rest/v1/feedback?customer_id=eq.${customerId}&select=feedback_id,transaction_id,rating,comment,created_at,transactions(locker_id,lockers(locker_number))&order=created_at.desc`,
    { headers: authHeaders(token) },
  )
}

/**
 * Checks whether the user has already submitted feedback for a given transaction.
 */
export async function hasFeedbackForTransaction(transactionId, token) {
  const rows = await request(
    `/rest/v1/feedback?transaction_id=eq.${transactionId}&select=feedback_id&limit=1`,
    { headers: authHeaders(token) },
  ).catch(() => null)
  return !!(rows && rows.length > 0)
}

/**
 * Fetches all feedback from the public.feedback table to display globally.
 * Includes reviewer name from the customers table.
 */
export async function fetchGlobalFeedback(token) {
  return request(
    '/rest/v1/feedback?select=feedback_id,rating,comment,created_at,customers(full_name)&order=created_at.desc&limit=30',
    { headers: authHeaders(token) },
  )
}

