import type { Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { configureApp } from '../src/app.setup';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestPrisma } from './db';

export interface TestApp {
  app: NestFastifyApplication;
  /** Real Prisma client bound to this jest worker's schema (same instance the app uses). */
  prisma: PrismaService;
  /** Closes the app and disconnects Prisma. Call from `afterAll` (after `resetDb`). */
  close: () => Promise<void>;
}

/**
 * HTTP-level integration helper: the real app setup (`configureApp`: prefix, versioning, filters) with the given
 * feature modules on the real test DB. Use with supertest: `request(app.getHttpServer()).post('/api/v1/...')`.
 *
 *   let t: TestApp;
 *   beforeAll(async () => { t = await createTestApp([EnvelopesModule]); });
 *   beforeEach(() => resetDb(t.prisma));
 *   afterAll(async () => { await resetDb(t.prisma); await t.close(); });
 */
export async function createTestApp(modules: Type<unknown>[]): Promise<TestApp> {
  const prisma = createTestPrisma();
  await prisma.$connect();

  const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, ...modules] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ logger: false }));
  configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    prisma,
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}
