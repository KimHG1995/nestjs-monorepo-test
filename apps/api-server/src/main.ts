import { NestFactory } from '@nestjs/core';
import { ApiServerModule } from './api-server.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import { GlobalExceptionFilter, TransformInterceptor } from '@app/common-utils';

async function bootstrap() {
  const app = await NestFactory.create(ApiServerModule);

  // 전역 유틸리티 적용
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger 설정
  patchNestJsSwagger();
  const config = new DocumentBuilder()
    .setTitle('User Activity Tracker API')
    .setDescription('사용자 활동을 추적하고 큐로 보내는 API')
    .setVersion('1.0')
    .addTag('activity')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`API 서버가 실행 중입니다: ${await app.getUrl()}`);
  console.log(
    `Swagger UI는 다음 주소에서 사용할 수 있습니다: ${await app.getUrl()}/api-docs`,
  );
}
bootstrap();
