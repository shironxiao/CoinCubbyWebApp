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
      body?.error_description || body?.msg || body?.message || 'Request failed.'
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

export async function registerAccount({ firstName, lastName, email, password }) {
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

  const userId = body.user?.id || ''
  const token = body.access_token || SUPABASE_ANON

  if (userId) {
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

export function sizeFromType(sizeTypeId) {
  if (Number(sizeTypeId) === 2) return { label: 'Medium', rate: 20 }
  if (Number(sizeTypeId) === 3) return { label: 'Large', rate: 30 }
  return { label: 'Small', rate: 10 }
}

export async function fetchLockers() {
  const rows = await request(
    '/rest/v1/lockers?select=locker_id,locker_number,status,size_type_id&order=locker_id.asc',
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
  await upsertCustomer(session)
  const rates = await fetchRates()
  const sizeTypeId = locker.sizeTypeId || (locker.size === 'Medium' ? 2 : locker.size === 'Large' ? 3 : 1)
  const rate = (rates || []).find((item) => Number(item.size_type_id) === Number(sizeTypeId))

  if (!rate) throw new Error(`Rate not found for ${locker.size}.`)

  const now = new Date()
  const qrToken = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
  const body = {
    customer_id: session.userId,
    rate_id: rate.rate_id,
    locker_id: locker.dbId,
    start_time: now.toISOString(),
    status: 'Active',
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

  if (transactionId) {
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

  await updateLockerStatus(locker.dbId, 'Occupied', session.accessToken)
  return transactionId
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
    `/rest/v1/customers?customer_id=eq.${user.id}&select=customer_id,full_name,email`,
    { headers: authHeaders(session?.accessToken, { Accept: 'application/json' }) },
  )

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

export async function completeRental(item, token) {
  const now = new Date()
  let durationMinutes = item.durationMinutes
  let finalAmount = 0

  if (item.isOpenTime) {
    durationMinutes = Math.max(60, Math.floor((now.getTime() - item.startMs) / 60000))
    finalAmount = (durationMinutes / 60) * item.ratePerHr
  }

  await request(`/rest/v1/transactions?transaction_id=eq.${item.transactionId}`, {
    method: 'PATCH',
    headers: authHeaders(token, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({
      status: 'Completed',
      end_time: now.toISOString(),
      duration_minutes: durationMinutes,
    }),
  })

  if (item.isOpenTime) {
    await request('/rest/v1/payments', {
      method: 'POST',
      headers: authHeaders(token, {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({
        transaction_id: item.transactionId,
        amount: finalAmount,
        payment_method: 'Device',
      }),
    })
  }

  await updateLockerStatus(item.lockerId, 'Available', token)
}

export function privateKeyFor(userId) {
  if (!userId) return '-'
  return `COIN-${userId.slice(0, 8).toUpperCase()}`
}

export function parseTimestamp(value) {
  if (!value) return -1
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? -1 : time
}

export function formatMoney(value) {
  return `₱${Number(value || 0).toFixed(2)}`
}
