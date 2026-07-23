# Prisma 7 및 TypeScript 7 호환성 마이그레이션 설계

- 작성일: 2026-07-23
- 상태: 승인됨
- 대상 저장소: `nestjs-event-driven-monorepo`

## 배경

저장소는 Prisma CLI 및 Client 5.22.0을 사용하지만 최신 Prisma 언어 서버는 Prisma 7 규칙으로 `schema.prisma`를 검사한다. 이 때문에 datasource 블록의 `url` 속성이 더 이상 지원되지 않는다는 진단이 표시된다. 현재 스키마는 Prisma 5 CLI에서는 유효하므로 URL 한 줄만 제거하면 경고는 사라져도 기존 CLI와 런타임이 깨진다.

TypeScript 구성도 유사한 전환 상태다. 루트 `tsconfig.json`은 제거 예정인 `baseUrl`과 비상대 `paths` 값을 사용하고, 별도의 `tsconfig.typecheck.json`만 네이티브 TypeScript 7 형식을 사용한다. 두 설정을 계속 분기하면 IDE, 기존 TypeScript 및 네이티브 TypeScript가 서로 다른 모듈 해석 규칙을 갖게 된다.

따라서 Prisma 7의 새 구성·생성기·드라이버 어댑터를 함께 적용하고 TypeScript 경로 구성을 TS 7 호환 형식으로 통일한다.

## 목표

1. Prisma CLI와 Client를 Prisma 7로 업그레이드한다.
2. 데이터베이스 URL을 `schema.prisma`에서 루트 `prisma.config.ts`로 이동한다.
3. PostgreSQL 연결에 공식 `@prisma/adapter-pg` 드라이버 어댑터를 사용한다.
4. 새 `prisma-client` 생성기와 명시적 출력 경로를 사용한다.
5. NestJS의 검증된 환경변수 계약을 Prisma Client 초기화에도 재사용한다.
6. 기존 NestJS CommonJS, Webpack 및 Jest 구조를 불필요하게 ESM으로 전환하지 않는다.
7. TypeScript의 `baseUrl`을 제거하고 TS 5.9와 TS 7의 경로 해석을 일치시킨다.
8. 로컬 설치, CI, Docker 빌드 및 운영 런타임이 동일한 생성 흐름을 사용하게 한다.

## 비목표

- NestJS 10 모노레포 전체를 ESM으로 전환하지 않는다.
- 데이터 모델 또는 실제 데이터베이스 테이블을 변경하지 않는다.
- 새로운 마이그레이션 SQL을 만들거나 기존 데이터를 변환하지 않는다.
- Prisma Accelerate 또는 Prisma Postgres 전용 URL을 도입하지 않는다.
- 데이터 접근 계층을 Repository 패턴 등으로 재설계하지 않는다.
- TypeScript 전체 `strict` 모드를 한 번에 활성화하지 않는다.

## 접근 비교

### 선택: Prisma 7 + CommonJS 생성 클라이언트

Prisma 7 전체 전환을 수행하되 새 생성기의 `moduleFormat = "cjs"` 옵션을 명시하여 현재 NestJS 빌드 형식을 유지한다. Prisma가 요구하는 구성 경계와 드라이버 어댑터는 최신 방식으로 바꾸면서 Jest, Nest CLI, Webpack 및 모든 애플리케이션의 모듈 형식을 동시에 바꾸는 위험은 피한다.

### 제외: 모노레포 전체 ESM 전환

`package.json`의 `type`, TypeScript module/moduleResolution, Jest 변환, import 확장자 및 Nest 빌드 결과를 함께 바꾸어야 한다. 장기적인 선택지가 될 수 있지만 Prisma 경고 해결과 독립적인 변경이 너무 많고 현재 요청 범위를 초과한다.

### 제외: Prisma 6 중간 마이그레이션

한 번의 변경 크기는 줄지만 Prisma 6에서 다시 Prisma 7로 이동해야 하므로 생성기, 런타임 연결 및 배포 구성을 두 차례 변경하게 된다. 최종 목표가 Prisma 7로 확정된 현재는 중복 비용이 더 크다.

## 의존성 설계

다음 패키지를 같은 Prisma 7 호환 버전대로 맞춘다.

- 런타임: `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`
- 개발 도구: `prisma`
- ERD 생성: `prisma-erd-generator` 2.x

현재 `prisma-erd-generator` 1.11.2의 peer dependency는 Prisma 4와 5만 지원하므로 Prisma 7과 함께 유지하지 않는다. `pg`는 실제 PostgreSQL 연결과 풀을 담당하고 `@prisma/adapter-pg`는 이를 Prisma Client에 연결한다. `dotenv`는 Prisma CLI가 루트 `.env`를 명시적으로 읽는 직접 의존성이다.

## Prisma 구성 설계

### `prisma.config.ts`

저장소 루트에 단일 Prisma CLI 진입점을 둔다.

- schema: `libs/prisma-client/prisma/schema.prisma`
- migrations: `libs/prisma-client/prisma/migrations`
- datasource URL: `process.env.DATABASE_URL`

`prisma generate`는 데이터베이스 URL이 필요하지 않지만 구성 로딩 중 `env("DATABASE_URL")`이 즉시 실패할 수 있다. 새 clone의 `npm ci`, CI 및 Docker build가 실제 DB secret 없이 Client를 생성할 수 있도록 config에서는 `process.env.DATABASE_URL ?? ""`를 사용한다. 반면 DB 연결이 필요한 migrate, db push 및 studio 명령은 빈 URL을 Prisma CLI 자체 검증에서 거부한다. 런타임은 아래의 Zod 기반 환경변수 검증을 별도로 통과해야 한다.

### `schema.prisma`

datasource에는 데이터베이스 종류만 남긴다.

```prisma
datasource db {
  provider = "postgresql"
}
```

Client 생성기는 다음 책임을 갖는다.

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"
}
```

출력은 `libs/prisma-client/generated/prisma`에 생성되며 기존 `.gitignore` 정책대로 커밋하지 않는다. 생성물은 로컬 소스 import를 통해 Nest Webpack 빌드에 포함된다.

## 런타임 연결 설계

`PrismaService`는 더 이상 `@prisma/client`의 자동 생성 진입점이나 `process.env`에 직접 의존하지 않는다.

1. `ConfigService<DatabaseEnv, true>`에서 검증된 `DATABASE_URL`을 가져온다.
2. 해당 URL로 `PrismaPg`를 생성한다.
3. 생성된 `PrismaClient`의 `super({ adapter, log })`에 어댑터와 기존 로그 정책을 함께 전달한다.
4. 기존 `OnModuleInit`의 `$connect()`와 `OnModuleDestroy`의 `$disconnect()`를 유지한다.

이 흐름은 앱의 Zod 환경변수 검증을 DB 연결 경계까지 보존하며 non-null assertion, 명시적 `any` 및 중복 환경변수 파싱을 만들지 않는다. `libs/prisma-client/src/index.ts`가 공개하는 `Prisma`와 `UserActivity`도 생성된 Client 경로에서 가져온다.

## 명령 및 생성 흐름

루트 `prisma.config.ts`가 schema 경로를 소유하므로 package script의 반복적인 `--schema` 옵션을 제거한다.

- `prisma:generate`: 모든 생성기 실행
- `prisma:erd`: ERD 생성기만 실행
- `prisma:migrate`, `prisma:studio`, `db:push`: 루트 config 자동 탐색
- `postinstall`: Client 생성기만 실행

개발자는 schema를 변경한 후 `npm run prisma:generate`를 실행한다. 새 clone과 CI는 `npm ci`의 postinstall에서 Client를 자동 생성한다.

## Docker 및 CI 설계

Docker builder는 `npm ci`의 postinstall 전에 다음 파일을 갖고 있어야 한다.

- `package.json`, `package-lock.json`
- `prisma.config.ts`
- `libs/prisma-client/prisma/schema.prisma`

Prisma 7 생성물은 더 이상 `node_modules/.prisma`에 위치하지 않으므로 runtime 이미지의 해당 COPY를 제거한다. 생성된 TypeScript Client는 애플리케이션 빌드에 포함되고, runtime에는 `@prisma/client`, `@prisma/adapter-pg`, `pg` 등 production dependency만 설치한다.

CI의 `npm ci`도 DB 연결 없이 Client를 생성할 수 있어야 한다. 이후 명시적 `npm run prisma:generate`와 `prisma validate`로 schema와 ERD 생성까지 검증한다.

## TypeScript 7 경로 마이그레이션

루트 `tsconfig.json`에서 `baseUrl`을 제거하고 모든 `paths` 대상에 `./` 접두사를 붙인다.

```json
"paths": {
  "@app/prisma-client": ["./libs/prisma-client/src"]
}
```

`tsconfig.typecheck.json`은 이미 이 형식을 사용하므로 중복된 설명 중 “기존 도구는 baseUrl을 유지한다”는 내용을 제거한다. 기존 TypeScript 5.9, ts-jest, ts-loader 및 tsconfig-paths는 `baseUrl` 없는 상대 `paths`를 지원하므로 별도 경고 억제 옵션은 추가하지 않는다.

네이티브 TS 7은 루트 설정의 테스트 파일에 필요한 Jest 및 Node 전역 타입을 명시적으로 로드하고, `export =` 형식인 supertest는 default import와 `esModuleInterop`로 사용한다. Nest CLI 10의 Webpack path plugin은 상속된 `paths`의 선언 위치를 보존하지 못하므로, `webpack.config.js`에서만 저장소 루트를 plugin `baseUrl`로 제공한다. deprecated TypeScript 옵션은 되살리지 않는다.

## 오류 처리

- CLI 구성은 DB가 필요 없는 생성 단계에서 환경변수 부재를 허용한다.
- DB 명령은 유효한 `DATABASE_URL` 없이는 실행하지 않는다.
- 애플리케이션 런타임은 기존 Zod `databaseEnvSchema`에서 URL을 검증한다.
- 연결 실패는 기존 `PrismaService` 로그 후 재throw 동작을 유지한다.
- PostgreSQL pool과 Prisma Client는 NestJS 종료 시 `$disconnect()`로 정리한다.
- 실제 DB 연결이 없는 단위 테스트는 `PrismaService`를 mock provider로 계속 대체한다.

## 테스트 및 검증

### 회귀 기준

- 기존 Prisma 5 스키마는 Prisma 7에서 datasource URL 오류를 발생시킨다.
- 기존 루트 `tsconfig.json`은 네이티브 TS 7에서 `baseUrl` 및 비상대 `paths` 오류를 발생시킨다.

### 자동 검증

1. `npx prisma validate`
2. `npm run prisma:generate`
3. `npm run typecheck`
4. `npm run typecheck:tsc`
5. `npx eslint .`
6. `npm test -- --runInBand`
7. `npm run build`
8. `npm run build:all`
9. `npx prettier --check .`

가능한 환경에서는 Docker Compose PostgreSQL을 실행해 `db push`와 Prisma Client 연결을 스모크 테스트한다. Docker를 사용할 수 없다면 schema validate, Client generate, 타입 검사 및 번들 빌드를 필수 게이트로 사용하고 DB 미검증 사실을 명시한다.

## 예상 변경 파일

- `package.json`
- `package-lock.json`
- `prisma.config.ts`
- `libs/prisma-client/prisma/schema.prisma`
- `libs/prisma-client/src/prisma.service.ts`
- `libs/prisma-client/src/index.ts`
- `tsconfig.json`
- `tsconfig.typecheck.json`
- `webpack.config.js`
- `eslint.config.mjs`
- `apps/api-server/test/activity.e2e-spec.ts`
- `apps/web-server/test/web-server.e2e-spec.ts`
- `Dockerfile`
- 필요 시 Prisma Client 초기화 단위 테스트

자동 생성된 `libs/prisma-client/generated/prisma/**`는 커밋하지 않는다.

## 완료 조건

- Prisma CLI 및 Client가 동일한 v7 호환 버전대를 사용한다.
- `schema.prisma` datasource에 URL 계열 속성이 없다.
- 루트 `prisma.config.ts`가 schema, migrations 및 CLI datasource URL을 소유한다.
- 런타임 Prisma Client가 `PrismaPg` 어댑터와 검증된 URL로 초기화된다.
- 새 `prisma-client` 생성기가 명시적 CommonJS 출력 경로를 사용한다.
- Prisma 및 애플리케이션 코드에 새 `any` 또는 불필요한 non-null assertion이 없다.
- `baseUrl`이 제거되고 두 TypeScript 설정의 paths 규칙이 일치한다.
- 새 clone, CI 및 Docker의 Client 생성 흐름이 정의되어 있다.
- Prisma validate/generate, 타입 검사, ESLint, 테스트 및 전체 빌드가 통과한다.

## 참고 자료

- [Prisma ORM 7 업그레이드](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [NestJS와 Prisma ORM](https://docs.prisma.io/docs/guides/frameworks/nestjs)
- [Prisma Client 생성기](https://www.prisma.io/docs/orm/prisma-schema/overview/generators)
- [Prisma Config API](https://docs.prisma.io/docs/orm/reference/prisma-config-reference)
- [TypeScript 6.0 발표](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
