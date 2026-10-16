import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import api, { getAccessToken, setAccessToken } from './api';

// Replaces the network layer so the real interceptors run against a scripted server.
function adapterFrom(handler: (config: InternalAxiosRequestConfig) => { status: number; data?: unknown }): AxiosAdapter {
  return async (config) => {
    const { status, data } = handler(config);
    const response = { data, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      throw new AxiosError('fail', String(status), config, null, response);
    }
    return response;
  };
}

describe('api client', () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it('keeps the access token in memory only', () => {
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('sends the bearer token and credentials', async () => {
    setAccessToken('tok');
    let seen: InternalAxiosRequestConfig | undefined;
    api.defaults.adapter = adapterFrom((c) => {
      seen = c;
      return { status: 200, data: { ok: true } };
    });
    await api.get('/vehicles');
    expect(seen?.headers.Authorization).toBe('Bearer tok');
    expect(api.defaults.withCredentials).toBe(true);
  });

  it('refreshes once on 401 and retries the original request', async () => {
    setAccessToken('expired');
    const calls: string[] = [];
    api.defaults.adapter = adapterFrom((c) => {
      calls.push(`${c.method} ${c.url} ${c.headers.Authorization}`);
      return c.headers.Authorization === 'Bearer fresh'
        ? { status: 200, data: { ok: true } }
        : { status: 401 };
    });
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: 'fresh' } } });

    const res = await api.get('/vehicles');

    expect(res.data).toEqual({ ok: true });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe('fresh');
    expect(calls).toEqual(['get /vehicles Bearer expired', 'get /vehicles Bearer fresh']);
  });

  it('shares one refresh between concurrent 401s', async () => {
    setAccessToken('expired');
    api.defaults.adapter = adapterFrom((c) =>
      c.headers.Authorization === 'Bearer fresh' ? { status: 200, data: {} } : { status: 401 },
    );
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: { accessToken: 'fresh' } } });

    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('gives up (and clears the token) when the refresh fails', async () => {
    setAccessToken('expired');
    api.defaults.adapter = adapterFrom(() => ({ status: 401 }));
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('401'));

    await expect(api.get('/vehicles')).rejects.toBeTruthy();
    expect(getAccessToken()).toBeNull();
  });
});
