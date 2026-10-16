import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { bearer, createUser, login, PASSWORD, resetDatabase } from '../helpers/factories';

const COOKIE = 'omnikinetix_rt';

beforeEach(resetDatabase);

describe('POST /api/auth/login', () => {
  it('returns an access token and sets an httpOnly refresh cookie (not in the body)', async () => {
    const user = await createUser('SUPER_ADMIN');
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();

    const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toContain(`${COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toContain('Path=/api/auth');
  });

  it('rejects a wrong password and an unknown email with the same 401', async () => {
    const user = await createUser('SUPER_ADMIN');
    const wrong = await request(app).post('/api/auth/login').send({ email: user.email, password: 'nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'x@y.ro', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  it('validates the payload', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('refresh / logout', () => {
  it('rotates the refresh token and rejects replay of the old one', async () => {
    const user = await createUser('SUPER_ADMIN');
    const { cookie: first } = await login(user.email);

    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.accessToken).toEqual(expect.any(String));
    expect((rotated.headers['set-cookie'] as unknown as string[])[0].split(';')[0]).not.toBe(first);

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(replay.status).toBe(401);
  });

  it('requires the cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('logout invalidates the refresh token and clears the cookie', async () => {
    const user = await createUser('SUPER_ADMIN');
    const { cookie } = await login(user.email);

    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    expect((out.headers['set-cookie'] as unknown as string[])[0]).toMatch(/Expires=Thu, 01 Jan 1970/);

    const after = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('requires a valid bearer token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(bearer('garbage'))).status).toBe(401);
  });

  it('returns the current user', async () => {
    const user = await createUser('COUNTRY_MANAGER');
    const { token } = await login(user.email);
    const res = await request(app).get('/api/auth/me').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });
});

describe('platform basics', () => {
  beforeAll(() => undefined);

  it('health check reports database status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('answers unknown API routes with JSON 404 and security headers', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('answers malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
  });
});
