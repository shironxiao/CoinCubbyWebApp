import { json, readJson, requireDevice, supabaseAdmin } from '../_shared/deviceApi.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabase = supabaseAdmin()
  const body = await readJson(req)
  const { device, response } = await requireDevice(req, supabase, body)
  if (response) return response

  const commandId = Number(body.command_id || 0)
  const result = String(body.result || 'success')

  if (!commandId) return json({ error: 'Missing command_id.' }, 400)

  const status = result === 'success' ? 'Completed' : 'Failed'

  const { error } = await supabase
    .from('device_commands')
    .update({
      status,
      error_message: status === 'Failed' ? String(body.error_message || 'Device reported failure.') : null,
      completed_at: new Date().toISOString(),
    })
    .eq('command_id', commandId)
    .eq('device_id', device.device_id)

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, status })
})

