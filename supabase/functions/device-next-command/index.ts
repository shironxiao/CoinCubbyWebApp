import { json, requireDevice, supabaseAdmin } from '../_shared/deviceApi.ts'

Deno.serve(async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed.' }, 405)

  const supabase = supabaseAdmin()
  const { device, response } = await requireDevice(req, supabase)
  if (response) return response

  const { data, error } = await supabase
    .from('device_commands')
    .select('command_id, locker_id, transaction_id, payment_session_id, command, payload')
    .eq('device_id', device.device_id)
    .eq('status', 'Pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) return json({ error: error.message }, 500)
  if (!data) return json(null)

  await supabase
    .from('device_commands')
    .update({
      status: 'Processing',
      claimed_at: new Date().toISOString(),
    })
    .eq('command_id', data.command_id)

  return json(data)
})

