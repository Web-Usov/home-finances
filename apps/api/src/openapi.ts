/**
 * Writes the OpenAPI document to apps/api/openapi.json without listening on a
 * port or connecting to the database (app.init() is never called, so
 * PrismaService.onModuleInit does not run). Run via `pnpm api:generate`.
 */
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { configureApp, createOpenApiDocument } from './app.setup';

async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  configureApp(app);
  const document = createOpenApiDocument(app);
  const out = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`OpenAPI written to ${out}`);
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
