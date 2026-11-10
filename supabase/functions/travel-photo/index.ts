import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { requireAdmin } from '../_shared/require-admin.ts';
import { ALLOWED_ORIGINS, corsOriginHeader } from '../_shared/site-origins.ts';
import { cleanJpeg } from './jpeg.ts';

const MAX_BYTES = 8 * 1024 * 1024;

serve(async req => {
  const headers = { ...corsOriginHeader(req), 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json' };
  const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  if (req.headers.has('Origin') && !ALLOWED_ORIGINS.has(req.headers.get('Origin')!)) return respond(403, { error: 'Forbidden' });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return respond(405, { error: 'Method not allowed' });
  try {
    const endpoint = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(endpoint, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    });
    const denied = await requireAdmin(userClient);
    if (denied) return respond(denied.status, { error: denied.status === 401 ? 'Unauthorized' : 'Forbidden' });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return respond(401, { error: 'Unauthorized' });
    if (!req.body || Number(req.headers.get('content-length') ?? 0) > MAX_BYTES) return respond(413, { error: 'Image too large' });
    const reader = req.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); return respond(413, { error: 'Image too large' }); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const part of parts) { bytes.set(part, at); at += part.length; }
    let jpeg: Uint8Array;
    try { jpeg = cleanJpeg(bytes); } catch { return respond(400, { error: 'Invalid image' }); }
    const path = `${user.id}/${crypto.randomUUID()}.jpg`;
    const service = createClient(endpoint, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { error } = await service.storage.from('travel-photos').upload(path, jpeg, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return respond(201, { path });
  } catch (error) {
    console.error('Travel photo upload failed', error);
    return respond(500, { error: 'Something went wrong' });
  }
});
