import { json, readJson, requireDevice, supabaseAdmin } from '../_shared/deviceApi.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabase = supabaseAdmin()
  const body = await readJson(req)
  const { device, response } = await requireDevice(req, supabase, body)
  if (response) return response

  const { error } = await supabase
    .from('devices')
    .update({
      status: String(body.status || 'Online'),
      last_seen_at: new Date().toISOString(),
    })
    .eq('device_id', device.device_id)

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true })
})

