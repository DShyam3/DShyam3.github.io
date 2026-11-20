import { describe, expect, it } from 'vitest';
import { classifySupabaseRequest } from './api-usage-fetch';

const BASE = 'https://example.supabase.co';

describe('classifySupabaseRequest', () => {
  it('classifies REST tables, RPCs, Edge Functions, Auth, and Storage', () => {
    expect(classifySupabaseRequest(`${BASE}/rest/v1/watchlist_items?select=*`, BASE)).toEqual({
      provider: 'supabase_rest',
      endpoint: 'watchlist_items',
    });
    expect(classifySupabaseRequest(`${BASE}/rest/v1/rpc/set_watched`, BASE)).toEqual({
      provider: 'supabase_rpc',
      endpoint: 'set_watched',
    });
    expect(
      classifySupabaseRequest(`${BASE}/functions/v1/tmdb-proxy?endpoint=movie/105/recommendations`, BASE),
    ).toEqual({
      provider: 'supabase_functions',
      endpoint: 'tmdb-proxy:movie/:id/recommendations',
    });
    expect(classifySupabaseRequest(`${BASE}/auth/v1/token?grant_type=refresh_token`, BASE)).toEqual({
      provider: 'supabase_auth',
      endpoint: 'token',
    });
    expect(classifySupabaseRequest(`${BASE}/storage/v1/object/travel/photo.jpg`, BASE)).toEqual({
      provider: 'supabase_storage',
      endpoint: 'object/travel',
    });
  });

  it('skips telemetry endpoints and unrelated origins to avoid feedback loops', () => {
    expect(classifySupabaseRequest(`${BASE}/rest/v1/api_usage_events`, BASE)).toBeNull();
    expect(classifySupabaseRequest(`${BASE}/rest/v1/rpc/get_active_rate_limits`, BASE)).toBeNull();
    expect(classifySupabaseRequest('https://api.themoviedb.org/3/movie/105', BASE)).toBeNull();
  });
});
