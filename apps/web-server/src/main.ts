import { readFileSync } from 'fs';

import { NestApplicationOptions, Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';

import { Logger } from '@app/logger';

import type { WebServerEnv } from './config/env';
import { WebServerModule } from './web-server.module';

type HttpsOptions = NestApplicationOptions['httpsOptions'];

/**
 * HTTPS 옵션을 구성합니다. 부팅 시점에는 아직 DI 컨테이너가 없으므로
 * TLS 관련 값만 `process.env` 에서 직접 읽습니다. (나머지 설정은 검증된 ConfigService 사용)
 */
function resolveHttpsOptions(logger: NestLogger): HttpsOptions | undefined {
  if (process.env.HTTPS_ENABLED !== 'true') {
    return undefined;
  }

  const keyPath = process.env.HTTPS_KEY_PATH;
  const certPath = process.env.HTTPS_CERT_PATH;
  if (!keyPath || !certPath) {
    logger.warn(
      'HTTPS_ENABLED=true 이지만 HTTPS_KEY_PATH/HTTPS_CERT_PATH 가 없어 HTTP 로 실행합니다.',
    );
    return undefined;
  }

  try {
    return {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
    };
  } catch (error) {
    logger.error(
      `TLS 인증서를 읽지 못해 HTTP 로 폴백합니다: ${(error as Error).message}`,
    );
    return undefined;
  }
}

async function bootstrap() {
  const bootstrapLogger = new NestLogger('Bootstrap');
  const httpsOptions = resolveHttpsOptions(bootstrapLogger);

  const app = await NestFactory.create(WebServerModule, {
    httpsOptions,
    bufferLogs: true,
  });

  // Nest 기본 로거를 pino 로 대체하여 부팅 로그까지 구조화합니다.
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<WebServerEnv, true>);
  const corsOrigin = config.get('CORS_ORIGIN', { infer: true });
  app.enableCors({
    origin:
      corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
  });
  app.enableShutdownHooks();

  // Swagger (zod DTO 를 문서에 반영하기 위해 patch 를 먼저 호출)
  patchNestJsSwagger();
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Web Server API')
    .setDescription(
      'RFC 7807 기반 표준 통신 프로토콜을 사용하는 범용 HTTPS REST API',
    )
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  const port = config.get('WEB_SERVER_PORT', { infer: true });
  await app.listen(port);

  const scheme = httpsOptions ? 'https' : 'http';
  bootstrapLogger.log(`web-server 가 실행 중입니다: ${await app.getUrl()}`);
  bootstrapLogger.log(`Swagger UI: ${scheme}://localhost:${port}/api-docs`);
}
void bootstrap();
