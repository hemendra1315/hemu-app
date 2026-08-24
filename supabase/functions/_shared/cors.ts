// Shared CORS headers for every Edge Function (Deno runtime).
// Kept in Phase 0 so all functions added later have one place to change.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function handlePreflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeaders });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ error: { code, message } }, status);
}
