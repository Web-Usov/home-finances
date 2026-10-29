import { INestApplication, VersioningType } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';

/** Global prefix, versioning, filters shared by main.ts and tooling. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalFilters(new DomainExceptionFilter());
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Family Budget API')
    .setDescription('API for family budget application — months, envelopes, allocations, operations')
    .setVersion('1.0')
    .build();
  return SwaggerModule.createDocument(app, config);
}
