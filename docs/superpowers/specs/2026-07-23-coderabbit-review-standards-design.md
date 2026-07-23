# CodeRabbit 리뷰 표준 및 TypeScript 타입 안전성 설계

- 작성일: 2026-07-23
- 상태: 구현 계획 작성 전 최종 검토
- 대상 저장소: `nestjs-event-driven-monorepo`

## 배경

README의 로드맵은 `.coderabbit.yaml` 기반 AI 코드 리뷰 스펙을 완료 항목으로 표시하지만, 저장소 루트에는 실제 설정 파일이 없다. 또한 운영 코드에 명시적 `any` 및 `z.any()`가 남아 있고 ESLint와 TypeScript 컴파일러도 이를 허용한다. 따라서 AI 리뷰 지침만 추가하면 저장소의 정적 검사 결과와 리뷰 정책이 서로 달라진다.

이 변경은 CodeRabbit의 리뷰 기준과 로컬 정적 검사를 함께 정렬한다. CodeRabbit은 프로젝트 구조를 이해하는 문맥 검토를 담당하고, ESLint와 TypeScript는 기계적으로 판정할 수 있는 타입 및 네이밍 규칙을 담당한다.

## 목표

1. 저장소 루트의 `.coderabbit.yaml`에 CodeRabbit 리뷰 동작과 프로젝트별 기준을 버전 관리한다.
2. 리뷰 코멘트와 PR 요약을 한국어로 고정한다.
3. TypeScript의 명시적·암묵적 `any` 및 `z.any()` 사용을 금지한다.
4. NestJS 모노레포의 애플리케이션, 공용 라이브러리, 테스트, 인프라 파일에 서로 다른 문맥별 리뷰 기준을 적용한다.
5. 역할 중심 네이밍을 정적 검사와 문맥 리뷰로 나누어 일관되게 적용한다.
6. 현재 API 및 SQS 메시지의 런타임 형식은 변경하지 않는다.

## 비목표

- TypeScript의 전체 `strict` 모드를 한 번에 활성화하지 않는다.
- 기존 기능이나 공개 API를 재설계하지 않는다.
- 테스트의 Jest `expect.any(...)` 매처는 제거하지 않는다. 이는 TypeScript 타입이 아니라 런타임 비대칭 매처다.
- 유료 플랜에 종속되는 CodeRabbit custom pre-merge checks는 추가하지 않는다.
- 현재 작업 트리의 관련 없는 변경을 수정, 포맷, 재정렬하거나 커밋하지 않는다.

## 선택한 접근

경로별 CodeRabbit 지침과 로컬 정적 검사를 조합하는 계층형 구성을 사용한다.

단일 공통 프롬프트만 사용하는 방식은 설정이 단순하지만 컨트롤러, 공용 라이브러리, 테스트 및 인프라의 서로 다른 책임을 구분하지 못한다. 별도의 저장소 전역 코딩 표준 문서와 custom pre-merge checks까지 도입하는 방식은 강제력이 높지만 현재 요청보다 관리 범위가 크고 요금제 의존성이 생긴다. 계층형 구성은 현재 저장소에 필요한 구체성과 이식성 사이의 균형을 제공한다.

## CodeRabbit 설정 설계

### 기본 동작

`.coderabbit.yaml`은 공식 schema v2 선언을 포함하고 다음 정책을 사용한다.

- `language: ko-KR`
- `reviews.profile: assertive`
- 자동 리뷰 활성화 및 Draft PR 자동 리뷰 비활성화
- `request_changes_workflow` 활성화
- 변경 요약 및 리뷰 상태 활성화
- poem과 진행 중 fortune 같은 비업무성 출력 비활성화
- CodeRabbit chat 자동 응답 활성화
- CodeRabbit ESLint 도구 활성화

리뷰 코멘트는 문제의 위치와 근거, 실제 영향, 가장 작은 수정 방향을 포함한다. 단순한 취향이나 이미 ESLint가 충분히 설명한 스타일 문제는 반복하지 않는다. 타입 안전성, 정확성, 보안, 데이터 손실, 공개 계약 위반 및 아키텍처 경계 위반을 우선한다.

### 리뷰 범위

다음 파일은 리뷰 가치가 없거나 자동 생성되므로 제외한다.

- `dist/**`
- `coverage/**`
- `node_modules/**`
- `package-lock.json`
- 자동 생성된 `libs/prisma-client/ERD.md`

TypeScript 소스, Prisma 원본 스키마, Docker 설정 및 GitHub Actions 워크플로는 리뷰 대상에 유지한다.

### 경로별 지침

#### 전체 TypeScript

대상: `**/*.ts`

- `any`, `as any`, `Record<..., any>`, `z.any()`를 허용하지 않는다.
- 외부 또는 동적 입력은 `unknown`으로 받고 스키마, 타입 가드 또는 판별 가능한 유니온으로 좁힌다.
- 불필요한 non-null assertion과 타입 단언을 지적한다.
- 변수와 함수는 역할을 설명하는 `camelCase`, 타입은 `PascalCase`, 상수는 필요에 따라 `UPPER_CASE`를 사용한다.
- 인터페이스에 `I` 접두사를 붙이지 않는다.
- 문맥 없이 `data`, `info`, `item`, `temp`, `value`처럼 의미가 약한 이름을 사용하지 않는다.
- 중복, 불필요한 추상화, 과도한 범용화보다 작은 책임과 명확한 계약을 우선한다.

#### 애플리케이션 소스

대상: `apps/**/src/**/*.ts`

- 컨트롤러는 HTTP 입출력 조정만 담당하고 비즈니스 로직은 서비스로 위임한다.
- 외부 입력은 DTO 또는 Zod 스키마 경계에서 검증한다.
- NestJS 의존성 주입을 사용하며 직접 인스턴스 생성과 숨은 전역 상태를 피한다.
- 비동기 호출은 await, 반환 또는 명시적 오류 처리 중 하나를 갖는다.
- 내부 오류, 민감정보 및 스택 트레이스를 외부 응답에 노출하지 않는다.
- 기존 RFC 7807 실패 응답과 정형화된 성공 응답 계약을 보존한다.
- Controller, Service, Module, DTO 등의 이름과 파일 접미사가 실제 역할과 일치하는지 확인한다.

#### 공용 라이브러리

대상: `libs/**/src/**/*.ts`

- 공용 라이브러리는 특정 앱 구현에 의존하지 않는다.
- 공개 진입점은 필요한 심볼만 노출하고 내부 구현을 누출하지 않는다.
- 순환 의존성, 숨은 부작용 및 요청별 상태를 singleton provider에 보관하는 문제를 확인한다.
- 재사용 가능한 계약과 앱별 정책을 분리한다.
- 라이브러리 이름과 내보내는 타입 또는 서비스의 책임이 일치하는지 확인한다.

#### 테스트

대상: `**/*.spec.ts`, `**/*.e2e-spec.ts`

- 테스트 이름은 조건과 기대 결과를 설명한다.
- 정상 경로뿐 아니라 실패, 경계값 및 회귀 조건을 검증한다.
- 시간, 네트워크, 실행 순서 또는 공유 상태에 의존하는 비결정적 테스트를 피한다.
- 내부 구현 호출 횟수보다 관찰 가능한 계약을 우선 검증한다.
- Jest의 `expect.any(...)`는 허용하지만 테스트 변수와 응답 타입에 TypeScript `any`를 사용하지 않는다.

#### 인프라 및 자동화

대상: `.github/**`, `Dockerfile`, `docker/**`, `docker-compose.yml`

- 비밀정보와 자격 증명 노출을 확인한다.
- GitHub Actions 권한과 컨테이너 실행 권한은 필요한 최소 범위로 제한한다.
- 빌드는 버전과 입력이 고정되어 재현 가능해야 한다.
- 서비스 의존성, 헬스체크, 종료 처리 및 안전한 환경변수 기본값을 확인한다.

#### Prisma

대상: `libs/prisma-client/prisma/**`

- 관계, unique 제약, 인덱스, nullable 여부 및 삭제 동작이 도메인 불변식을 지키는지 확인한다.
- 파괴적 스키마 변경과 이전 버전 호환 위험을 지적한다.
- 자동 생성 결과가 아니라 원본 스키마와 마이그레이션을 검토한다.

## 정적 검사 및 코드 변경

### `any` 제거

- `libs/sqs-client/src/sqs-client.service.ts`의 제네릭 제약을 `Record<string, unknown>`으로 변경한다.
- `apps/api-server/src/track-activity.dto.ts`의 `z.record(z.any())`를 `z.record(z.unknown())`으로 변경한다.
- `apps/activity-worker/src/activity-worker.service.ts`의 동일한 런타임 스키마도 `z.unknown()`으로 변경한다.

`z.unknown()`은 입력 허용 범위를 축소하지 않지만 추론 결과를 `unknown`으로 만들어 검증되지 않은 멤버 접근을 방지한다. 따라서 HTTP 및 SQS 페이로드의 직렬화 형식은 바뀌지 않는다.

### ESLint

- `@typescript-eslint/no-explicit-any`를 `off`에서 `error`로 변경한다.
- `@typescript-eslint/naming-convention`을 추가한다.
- 일반 변수, 함수 및 매개변수는 `camelCase`를 사용한다. 사용하지 않는 매개변수의 선행 밑줄은 허용한다.
- `const` 변수는 `camelCase` 또는 `UPPER_CASE`를 허용한다.
- 타입 계열 선언은 `PascalCase`를 사용한다.
- 외부 API, 환경변수 및 직렬화 계약의 프로퍼티 이름은 일괄 제한하지 않는다.
- 테스트별 완화 설정에서도 `no-explicit-any`는 끄지 않는다.

boolean 접두사와 파일 또는 NestJS 역할 접미사는 단순 문법만으로 정확히 판정하기 어려우므로 ESLint 대신 CodeRabbit의 문맥 리뷰로 처리한다.

### TypeScript

- `tsconfig.json`의 `noImplicitAny`를 `true`로 변경한다.
- `tsconfig.typecheck.json`의 `noImplicitAny`도 `true`로 변경한다.
- 이번 변경에서 `strictNullChecks` 등 다른 strict 옵션은 확대하지 않는다.

## 처리 흐름

1. PR의 변경 파일이 CodeRabbit path filter를 통과한다.
2. 공통 TypeScript 지침과 일치하는 경로별 지침이 변경 파일에 적용된다.
3. CodeRabbit의 ESLint 도구가 저장소의 `eslint.config.mjs`를 사용한다.
4. 정적 분석 결과와 문맥 분석을 종합해 한국어 코멘트를 작성한다.
5. 수정 필요 이슈가 남아 있으면 Request Changes 상태를 유지하고, 해결되면 승인 상태로 전환한다.

로컬 개발에서는 ESLint가 명시적 `any`와 기본 네이밍 위반을 차단하고 TypeScript가 암묵적 `any`를 차단한다. AI 리뷰를 실행하지 않아도 핵심 타입 정책은 동일하게 유지된다.

## 오류 처리와 호환성

- `.coderabbit.yaml`은 schema v2로 검증하여 잘못된 키와 타입을 구현 단계에서 차단한다.
- CodeRabbit의 ESLint 환경은 타입 정보 기반 규칙 일부를 지원하지 않을 수 있으므로 `no-explicit-any`와 기본 naming convention처럼 타입 서비스에 의존하지 않는 규칙을 핵심 강제 수단으로 사용한다.
- `unknown`으로 바꾼 값에 새 멤버 접근이 필요하면 사용 지점에서 명시적으로 좁힌다. 안전하지 않은 단언으로 우회하지 않는다.
- CodeRabbit이 설치되지 않은 저장소에서도 로컬 ESLint, typecheck, 테스트 및 빌드는 독립적으로 동작한다.

## 검증 계획

1. `.coderabbit.yaml`을 공식 schema v2에 대해 검증한다.
2. 변경 파일에 Prettier 검사만 실행하며 사용자 파일을 자동 수정하지 않는다.
3. ESLint를 `--fix` 없이 실행한다.
4. `npm run typecheck`를 실행한다.
5. 단위 테스트 전체를 실행한다.
6. `npm run build:all`을 실행한다.
7. `z.any()`와 TypeScript `any`가 남아 있지 않은지 검색한다. Jest `expect.any(...)`는 허용 목록으로 구분한다.

외부 서비스가 필요한 e2e 테스트는 이번 설정 및 타입 변경의 필수 검증에서 제외한다. 변경이 런타임 계약을 바꾸지 않으며 단위 테스트와 전체 빌드가 해당 경로를 검증한다.

## 변경 예상 파일

- `.coderabbit.yaml`
- `eslint.config.mjs`
- `tsconfig.json`
- `tsconfig.typecheck.json`
- `libs/sqs-client/src/sqs-client.service.ts`
- `apps/api-server/src/track-activity.dto.ts`
- `apps/activity-worker/src/activity-worker.service.ts`

README의 로드맵 항목은 이미 완료로 표시되어 있으므로 링크가 실제 파일을 가리키게 되는 것 외에는 수정하지 않는다.

## 완료 조건

- 저장소 루트에 schema v2 검증을 통과하는 `.coderabbit.yaml`이 존재한다.
- CodeRabbit 리뷰와 요약이 한국어로 생성되도록 설정되어 있다.
- 리뷰 규칙이 TypeScript, 앱, 라이브러리, 테스트, 인프라 및 Prisma 경로별로 분리되어 있다.
- 운영 코드와 테스트 타입 선언에 명시적 `any`가 없고 `z.any()`가 없다.
- Jest `expect.any(...)` 테스트는 정상적으로 유지된다.
- 두 TypeScript 설정 모두 암묵적 `any`를 거부한다.
- ESLint, typecheck, 단위 테스트 및 전체 빌드가 통과한다.
- 관련 없는 기존 작업 트리 변경은 수정하거나 커밋하지 않는다.

## 참고 자료

- [CodeRabbit YAML configuration](https://docs.coderabbit.ai/getting-started/yaml-configuration)
- [CodeRabbit path instructions](https://docs.coderabbit.ai/configuration/path-instructions)
- [CodeRabbit ESLint integration](https://docs.coderabbit.ai/tools/eslint)
- [CodeRabbit configuration reference](https://docs.coderabbit.ai/reference/configuration)
