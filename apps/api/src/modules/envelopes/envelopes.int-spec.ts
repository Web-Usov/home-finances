import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { EnvelopesModule } from './envelopes.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { configureApp } from '../../app.setup';
import { createTestPrisma, resetDb } from '../../../test/db';

/** HTTP-level integration test: real app setup (pipes, filters) on the real test DB. */
describe('Envelopes HTTP validation (integration)', () => {
  let prisma: PrismaService;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();

    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, EnvelopesModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ logger: false }));
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app?.close();
    await resetDb(prisma);
    await prisma.$disconnect();
  });

  it('API-17: POST /envelopes with empty name returns 422', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/envelopes').send({ name: '' }).expect(422);

    expect(response.body).toEqual({ error: 'VALIDATION_ERROR', message: expect.stringContaining('name') });
    expect(await prisma.envelope.count()).toBe(0);
  });
});
