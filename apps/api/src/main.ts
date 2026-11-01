import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp, createOpenApiDocument } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  configureApp(app);

  // Swagger / OpenAPI
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api', app, document, {
    jsonDocumentUrl: 'api/swagger.json',
  });

  const port = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3000;
  // API_HOST lets the preview environment bind the API to loopback behind its reverse proxy.
  await app.listen(port, process.env.API_HOST ?? '0.0.0.0');

  // eslint-disable-next-line no-console
  console.log(`Application is running on: http://localhost:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`Swagger UI: http://localhost:${port}/api`);
}

bootstrap();
