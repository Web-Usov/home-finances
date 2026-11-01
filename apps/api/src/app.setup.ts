import { INestApplication, VersioningType } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { MonthETagInterceptor } from './common/month-etag';

/** Global prefix, versioning, filters, ETag interceptor and CORS shared by main.ts and tooling. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new MonthETagInterceptor(new Reflector()));

  // API-26: the browser client reads `ETag` and sends `If-Match` (and the JSON content type).
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'If-Match'],
    exposedHeaders: ['ETag'],
    credentials: false,
  });
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Family Budget API')
    .setDescription('API for family budget application — months, envelopes, allocations, operations')
    .setVersion('1.0')
    .build();
  return SwaggerModule.createDocument(app, config);
}
