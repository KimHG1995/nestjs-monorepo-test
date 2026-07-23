import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ZodType } from 'zod';

import { createEnvValidator } from './validate-env';

/**
 * 전역 타입 세이프 설정 모듈입니다.
 *
 * 앱의 루트 모듈에서 자신의 Zod 환경변수 스키마를 넘겨 호출합니다.
 *
 * ```ts
 * imports: [TypedConfigModule.forRoot(webServerEnvSchema)]
 * ```
 *
 * 주입은 `@nestjs/config` 의 `ConfigService` 를 그대로 사용하되,
 * 앱에서 추론된 Env 타입을 제네릭으로 지정하면 완전한 타입 세이프 접근이 가능합니다.
 *
 * ```ts
 * constructor(private readonly config: ConfigService<WebServerEnv, true>) {}
 * // config.get('LOG_LEVEL', { infer: true }) -> LogLevel 타입으로 추론
 * ```
 */
@Module({})
export class TypedConfigModule {
  static forRoot(schema: ZodType): DynamicModule {
    return {
      module: TypedConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          validate: createEnvValidator(schema),
        }),
      ],
      exports: [ConfigModule],
    };
  }
}
