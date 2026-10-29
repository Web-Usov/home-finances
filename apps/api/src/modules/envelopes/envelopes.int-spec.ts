import request from 'supertest';
import { EnvelopesModule } from './envelopes.module';
import { PrismaService } from '../../prisma/prisma.service';
import { resetDb } from '../../../test/db';
import { createTestApp, TestApp } from '../../../test/http';

/** HTTP-level integration test: real app setup (pipes, filters) on the real test DB. */
describe('Envelopes HTTP validation (integration)', () => {
  let t: TestApp;
  let prisma: PrismaService;

  beforeAll(async () => {
    t = await createTestApp([EnvelopesModule]);
    prisma = t.prisma;
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await resetDb(prisma);
    await t?.close();
  });

  it('API-17: POST /envelopes with empty name returns 422', async () => {
    const response = await request(t.app.getHttpServer()).post('/api/v1/envelopes').send({ name: '' }).expect(422);

    expect(response.body).toEqual({ error: 'VALIDATION_ERROR', message: expect.stringContaining('name') });
    expect(await prisma.envelope.count()).toBe(0);
  });
});
