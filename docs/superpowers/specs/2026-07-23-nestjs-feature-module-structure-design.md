# NestJS Feature Module Structure Design

## Goal

`apps/api-server`, `apps/activity-worker`, `apps/web-server`를 NestJS의 루트
모듈과 기능 모듈 역할이 명확히 구분되는 `src/modules/<domain>` 구조로
정리한다. HTTP 경로, 이벤트 계약, 데이터 저장 방식, 환경 변수, 응답 프로토콜은
변경하지 않는다.

## Context

NestJS는 `src/modules` 디렉터리를 강제하지 않지만, 컨트롤러와 프로바이더를
기능 모듈로 캡슐화하고 루트 모듈이 기능 모듈을 조립하는 구조를 권장한다. 현재
세 앱은 다음과 같이 서로 다른 수준의 구조를 사용한다.

- `api-server`: 컨트롤러, 서비스, DTO가 모두 `src` 루트에 있다.
- `activity-worker`: 폴링 서비스가 `src` 루트에 있고 루트 모듈이 직접 제공한다.
- `web-server`: 상품과 분석은 기능별 폴더지만 `modules` 경계가 없고, 헬스
  컨트롤러는 루트 모듈이 직접 소유한다.

이 차이는 기능이 늘어날수록 루트 모듈의 책임과 파일 위치를 예측하기 어렵게
만든다.

## Chosen Approach

모든 앱에 동일한 feature-first 규칙을 적용한다.

1. `main.ts`, 앱 루트 모듈, `config`만 `src` 루트에 둔다.
2. 비즈니스 기능은 `src/modules/<domain>` 아래에 둔다.
3. 각 기능 모듈이 자신의 컨트롤러, 서비스, DTO, 단위 테스트를 소유한다.
4. 외부 인프라 모듈은 실제로 사용하는 기능 모듈에서 명시적으로 import한다.
5. 앱 이름이 아니라 비즈니스 역할을 클래스와 파일 이름에 사용한다.
6. 앱 간 공통 기능은 기존 `libs/*`에 유지하며 앱 내부로 복제하지 않는다.

## Target Structure

```text
apps/
├── api-server/
│   └── src/
│       ├── config/
│       │   └── env.ts
│       ├── modules/
│       │   └── activity/
│       │       ├── dto/
│       │       │   └── track-activity.dto.ts
│       │       ├── activity.controller.spec.ts
│       │       ├── activity.controller.ts
│       │       ├── activity.module.ts
│       │       └── activity.service.ts
│       ├── api-server.module.ts
│       └── main.ts
├── activity-worker/
│   └── src/
│       ├── config/
│       │   └── env.ts
│       ├── modules/
│       │   └── activity-consumer/
│       │       ├── activity-consumer.module.ts
│       │       ├── activity-consumer.service.spec.ts
│       │       └── activity-consumer.service.ts
│       ├── activity-worker.module.ts
│       └── main.ts
└── web-server/
    └── src/
        ├── config/
        │   └── env.ts
        ├── modules/
        │   ├── admin/
        │   │   └── analytics/
        │   │       ├── dto/
        │   │       ├── analytics.controller.ts
        │   │       ├── analytics.module.ts
        │   │       ├── analytics.service.spec.ts
        │   │       ├── analytics.service.ts
        │   │       ├── funnel-calculator.spec.ts
        │   │       └── funnel-calculator.ts
        │   ├── health/
        │   │   ├── health.controller.ts
        │   │   └── health.module.ts
        │   └── products/
        │       ├── dto/
        │       ├── products.controller.ts
        │       ├── products.module.ts
        │       ├── products.service.spec.ts
        │       └── products.service.ts
        ├── web-server.module.ts
        └── main.ts
```

## Module Boundaries

### API Server

`ApiServerModule`은 환경 설정, 로깅, HTTP 프로토콜과 `ActivityModule`을
조립한다. `ActivityModule`은 `SqsClientModule`을 import하고
`ActivityController`와 `ActivityService`를 소유한다.

기존 `ApiServerController`와 `ApiServerService`는 각각
`ActivityController`, `ActivityService`로 변경한다. 앱의 배포 단위가 아니라
담당 비즈니스 기능을 이름으로 표현하기 위해서다.

### Activity Worker

`ActivityWorkerModule`은 환경 설정, 로깅과 `ActivityConsumerModule`을
조립한다. `ActivityConsumerModule`은 `SqsClientModule`, `PrismaModule`을
import하고 `ActivityConsumerService`를 제공한다.

`ActivityConsumerService`는 기존과 동일하게 `OnModuleInit`에서 설정을
확인한 뒤 SQS 폴링을 시작하고, 메시지를 검증해 PostgreSQL에 저장한다.

### Web Server

`WebServerModule`은 공통 설정과 `ProductsModule`, `AnalyticsModule`,
`HealthModule`을 조립한다. `ProductsModule`과 `AnalyticsModule`은 각자
`PrismaModule`을 명시적으로 import한다. `HealthController`는 새
`HealthModule`이 소유한다.

`admin`은 URL과 비즈니스 경계를 나타내므로
`modules/admin/analytics` 계층을 유지한다.

## Dependency Rules

- 앱 루트 모듈은 기능 모듈 내부의 컨트롤러나 서비스를 직접 등록하지 않는다.
- 기능 모듈은 다른 기능 모듈의 내부 파일을 import하지 않는다.
- 공유 계약과 인프라는 `@app/*` 라이브러리 공개 진입점만 사용한다.
- DTO와 테스트는 해당 기능 모듈 안에 둔다.
- 순환 참조를 숨길 수 있는 앱 내부 barrel 파일은 추가하지 않는다.
- 명시적 `any` 타입을 추가하지 않는다.

## Compatibility

다음 외부 동작은 그대로 유지한다.

- `POST /activity/track`
- `/products` CRUD
- `GET /admin/analytics/funnel`
- `GET /health`
- 성공 응답 봉투와 RFC 7807 오류
- SQS 메시지 형식과 FIFO 사용자 순서
- Prisma 스키마와 마이그레이션
- 환경 변수 이름과 기본값
- Nest CLI 프로젝트 이름과 빌드 엔트리포인트

이번 변경은 파일 구조, 내부 클래스 이름, Nest 모듈 조립만 변경한다.

## Testing

- 이동된 API 컨트롤러와 Worker 서비스 단위 테스트를 새 이름과 경로로 갱신한다.
- 상품과 분석 단위 테스트는 경로만 이동하고 기대 동작은 변경하지 않는다.
- API Server와 Web Server e2e 테스트로 루트 모듈 조립 및 공개 경로를 검증한다.
- TypeScript 7과 TypeScript 5 타입 검사를 모두 실행한다.
- ESLint, 전체 Jest 테스트, 세 앱 빌드와 기본 빌드를 실행한다.
- `apps/*/src`에서 기능 구현 파일이 `modules` 밖에 남아 있지 않은지 검사한다.

## Alternatives Considered

### Move Only

파일만 `modules` 아래로 옮기고 클래스 이름을 유지하는 방법이다. 변경 위험은
작지만 `ApiServerService`처럼 기능을 설명하지 않는 이름이 남아 구조 개선 효과가
제한적이어서 선택하지 않았다.

### Layered Clean Architecture

각 기능을 presentation, application, domain, infrastructure 계층으로 더 세분화하는
방법이다. 큰 도메인에는 유용하지만 현재 기능 크기에는 파일과 추상화가 지나치게
늘어나므로 선택하지 않았다.
