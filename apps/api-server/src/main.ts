import { Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';

import { Logger } from '@app/logger';

import { ApiServerModule } from './api-server.module';
import type { ApiServerEnv } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(ApiServerModule, { bufferLogs: true });

  // 표준 통신 프로토콜(검증 파이프 + 응답 봉투 + RFC7807 필터)은 HttpProtocolModule 이
  // 전역으로 등록하므로 main 에서 별도의 useGlobal* 호출이 필요 없습니다.
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // Swagger (zod DTO 반영을 위해 patch 를 먼저 호출)
  patchNestJsSwagger();
  const swaggerConfig = new DocumentBuilder()
    .setTitle('User Activity Tracker API')
    .setDescription('사용자 활동을 추적하고 큐로 보내는 API')
    .setVersion('1.0')
    .addTag('Activity Tracker')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  const config = app.get(ConfigService<ApiServerEnv, true>);
  const port = config.get('API_SERVER_PORT', { infer: true });
  await app.listen(port);

  const logger = new NestLogger('Bootstrap');
  logger.log(`api-server 가 실행 중입니다: ${await app.getUrl()}`);
  logger.log(`Swagger UI: ${await app.getUrl()}/api-docs`);
}
void bootstrap();
