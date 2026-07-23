import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

const TRACE_ID_HEADER = 'x-request-id';

/**
 * `nestjs-pino` 기반의 구조화된 로깅 모듈입니다.
 *
 * 핵심 특징:
 * - **요청 상관관계(correlation)**: 요청마다 `x-request-id`(없으면 UUID 생성)를 `req.id` 로
 *   부여하고 응답 헤더로 되돌려 줍니다. 이 값이 곧 표준 응답의 `meta.traceId`,
 *   에러 응답의 `traceId` 와 동일하여 로그·응답을 하나의 ID 로 추적할 수 있습니다.
 * - **환경별 포맷**: 개발 환경은 `pino-pretty` 로 사람이 읽기 좋게, 그 외에는 JSON 으로 출력합니다.
 * - **민감정보 마스킹**: Authorization/Cookie 헤더를 자동으로 가립니다.
 *
 * 앱의 루트 모듈에서 `imports: [AppLoggerModule.forRoot()]` 로 사용하고,
 * `main.ts` 에서 `app.useLogger(app.get(Logger))` 로 Nest 기본 로거를 대체합니다.
 */
@Module({})
export class AppLoggerModule {
  static forRoot(): DynamicModule {
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';
    const level =
      process.env.LOG_LEVEL ??
      (isTest ? 'silent' : isProduction ? 'info' : 'debug');
    // pino-pretty 는 워커 스레드를 띄우므로, 개발 환경에서만 사용합니다.
    // (테스트에서는 Jest 오픈 핸들을 방지하기 위해 비활성화)
    const usePretty = !isProduction && !isTest;

    return {
      module: AppLoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          pinoHttp: {
            level,
            // 개발 환경에서는 보기 좋은 컬러 로그, 그 외에는 수집에 유리한 JSON.
            transport: usePretty
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
            // 요청 추적 ID: 헤더에 있으면 재사용, 없으면 생성하고 응답 헤더로 반환.
            genReqId: (req: IncomingMessage, res: ServerResponse): string => {
              const existing = req.headers[TRACE_ID_HEADER];
              const id =
                (typeof existing === 'string' && existing) ||
                (Array.isArray(existing) && existing[0]) ||
                randomUUID();
              res.setHeader(TRACE_ID_HEADER, id);
              return id;
            },
            // pino-http 시그니처와 정확히 일치하도록 매개변수는 IncomingMessage 로 두고,
            // pino-http 이 부여한 req.id 는 안전하게 좁혀서 읽습니다.
            customProps: (req: IncomingMessage) => {
              const id = (req as IncomingMessage & { id?: string | number }).id;
              return { traceId: id === undefined ? undefined : String(id) };
            },
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
              censor: '[REDACTED]',
            },
            autoLogging: true,
          },
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}
