import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function supabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(url, key)
}

export async function readJson(req: Request) {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

export function deviceTokenFrom(req: Request, body: Record<string, unknown> = {}) {
  return String(req.headers.get('x-device-token') || body.device_token || '')
}

export async function requireDevice(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown> = {},
) {
  const url = new URL(req.url)
  const deviceCode = String(body.device_code || url.searchParams.get('device_code') || '')
  const deviceToken = deviceTokenFrom(req, body)

  if (!deviceCode || !deviceToken) {
    return {
      device: null,
      response: json({ error: 'Missing device_code or device token.' }, 401),
    }
  }

  const { data, error } = await supabase
    .from('devices')
    .select('device_id, device_code, token_hash')
    .eq('device_code', deviceCode)
    .maybeSingle()

  if (error || !data) {
    return {
      device: null,
      response: json({ error: 'Device not registered.' }, 401),
    }
  }

  // Prototype check: store the exact token in token_hash.
  // Production check: replace this with a hashed-token comparison.
  if (!data.token_hash || data.token_hash !== deviceToken) {
    return {
      device: null,
      response: json({ error: 'Invalid device token.' }, 401),
    }
  }

  return {
    device: data,
    response: null,
  }
}

