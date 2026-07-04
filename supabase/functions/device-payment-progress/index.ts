import { json, readJson, requireDevice, supabaseAdmin } from '../_shared/deviceApi.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabase = supabaseAdmin()
  const body = await readJson(req)
  const { device, response } = await requireDevice(req, supabase, body)
  if (response) return response

  const paymentSessionId = Number(body.payment_session_id || 0)
  const amountInserted = Number(body.amount_inserted || 0)

  if (!paymentSessionId || amountInserted <= 0) {
    return json({ error: 'Missing payment_session_id or amount_inserted.' }, 400)
  }

  const { data: session, error: sessionError } = await supabase
    .from('payment_sessions')
    .select('payment_session_id, transaction_id, locker_id, device_id, session_type, amount_due, amount_paid, status')
    .eq('payment_session_id', paymentSessionId)
    .eq('device_id', device.device_id)
    .maybeSingle()

  if (sessionError) return json({ error: sessionError.message }, 500)
  if (!session) return json({ error: 'Payment session not found.' }, 404)
  if (session.status !== 'Pending') return json({ ok: true, status: session.status })

  const newAmountPaid = Number(session.amount_paid || 0) + amountInserted
  const isPaid = newAmountPaid >= Number(session.amount_due || 0)

  const { error: updateError } = await supabase
    .from('payment_sessions')
    .update({
      amount_paid: newAmountPaid,
      status: isPaid ? 'Paid' : 'Pending',
      updated_at: new Date().toISOString(),
    })
    .eq('payment_session_id', paymentSessionId)

  if (updateError) return json({ error: updateError.message }, 500)

  if (!isPaid) {
    return json({
      ok: true,
      status: 'Pending',
      amount_paid: newAmountPaid,
      remaining: Math.max(0, Number(session.amount_due || 0) - newAmountPaid),
    })
  }

  await supabase.from('payments').insert({
    transaction_id: session.transaction_id,
    amount: Number(session.amount_due || 0),
    payment_method: 'Device',
  })

  if (session.session_type === 'rental_payment') {
    await supabase
      .from('transactions')
      .update({ status: 'Active' })
      .eq('transaction_id', session.transaction_id)

    await supabase
      .from('lockers')
      .update({ status: 'Occupied' })
      .eq('locker_id', session.locker_id)

    await supabase.from('device_commands').insert({
      device_id: device.device_id,
      locker_id: session.locker_id,
      transaction_id: session.transaction_id,
      payment_session_id: session.payment_session_id,
      command: 'unlock_locker',
      payload: {},
    })
  }

  if (session.session_type === 'overtime_payment') {
    await supabase
      .from('transactions')
      .update({
        status: 'Completed',
        end_time: new Date().toISOString(),
      })
      .eq('transaction_id', session.transaction_id)

    await supabase
      .from('lockers')
      .update({ status: 'Available' })
      .eq('locker_id', session.locker_id)

    await supabase.from('device_commands').insert({
      device_id: device.device_id,
      locker_id: session.locker_id,
      transaction_id: session.transaction_id,
      payment_session_id: session.payment_session_id,
      command: 'release_locker',
      payload: {},
    })
  }

  return json({
    ok: true,
    status: 'Paid',
    amount_paid: newAmountPaid,
    remaining: 0,
  })
})

