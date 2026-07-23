# 커머스 행동 분석 어드민 설계

## 배경

현재 `web-server`의 `Widget` CRUD는 프로세스 메모리에만 데이터를 저장하는 예제 기능이다.
반면 `api-server → SQS → activity-worker → PostgreSQL` 경로는 사용자 활동을 실제
`UserActivity` 테이블에 적재한다. 이 두 흐름을 하나의 커머스 시나리오로 연결해
프로젝트가 실제 비즈니스 기능을 보여주도록 개선한다.

## 목표

- 인메모리 `Widget` 예제를 실제 PostgreSQL 기반 `Product` 관리 API로 교체한다.
- 기존 사용자 활동 이벤트에 상품 관계와 `purchase` 단계를 추가한다.
- `web-server`에서 상품별 `view_product → add_to_cart → purchase` 퍼널을 조회한다.
- 기존 Zod 검증, 표준 성공 응답, RFC 7807 오류 응답, 구조화 로깅 방식을 유지한다.
- 명시적 `any` 없이 도메인 타입과 이름을 구체적으로 정의한다.

## 검토한 접근법

### 1. 고정 퍼널과 실제 상품 DB — 채택

`Product`와 `UserActivity`를 연결하고 세 단계 퍼널을 코드에 고정한다. 현재 이벤트
파이프라인을 그대로 활용하면서 구현 범위가 작고, 상품 관리와 행동 분석이라는 하나의
비즈니스 이야기를 완성할 수 있다.

### 2. 동적 퍼널 정의

`Funnel`과 `FunnelStep`을 별도 테이블로 관리해 임의의 이벤트 조합을 지원한다. 유연하지만
단계 순서 검증, 수정 이력, 중복 정의, 관리 API가 추가되어 현재 요구보다 크다.

### 3. 사전 집계 분석

worker가 일별 집계 테이블을 갱신해 조회 성능을 높인다. 운영 규모에는 적합하지만 SQS
재처리 시 멱등성, 재집계, 원본 이벤트와 집계의 정합성 관리가 필요하다.

## 범위

### 포함

- Prisma `Product` 모델과 `UserActivity.productId` 관계
- 상품 CRUD와 페이지네이션
- 상품 소프트 삭제
- 상품별·기간별 고정 퍼널 분석
- 공통 활동 이벤트 Zod 스키마
- `purchase` 이벤트 지원
- Prisma 마이그레이션, 클라이언트, ERD 갱신
- 단위 테스트와 web-server API 테스트
- README의 실행 및 API 예시 갱신

### 제외

- 관리자 인증과 역할 기반 권한
- 관리자 화면
- 주문·결제·장바구니 테이블
- 동적 퍼널 설정
- 집계 테이블과 캐시
- 기존 운영 데이터의 상품 ID 자동 추론

## 데이터 모델

### Product

| 필드                | 타입         | 규칙                    |
| ------------------- | ------------ | ----------------------- |
| `id`                | UUID 문자열  | 기본키                  |
| `sku`               | 문자열       | 대문자로 정규화, 고유   |
| `name`              | 문자열       | 1~120자                 |
| `priceInMinorUnits` | 정수         | 0 이상, 부동소수점 금지 |
| `currency`          | 3자리 문자열 | 기본값 `KRW`            |
| `stockQuantity`     | 정수         | 0 이상                  |
| `createdAt`         | DateTime     | 생성 시각               |
| `updatedAt`         | DateTime     | 수정 시각               |
| `deletedAt`         | DateTime?    | 소프트 삭제 시각        |

상품에 활동 이력이 있어도 분석 데이터가 유지되어야 하므로 `DELETE /products/:id`는
레코드를 제거하지 않고 `deletedAt`을 설정한다. 일반 조회에서는 삭제된 상품을 제외하고,
이미 삭제된 상품의 재삭제는 멱등적으로 성공시키지 않고 `404`로 처리한다.

### UserActivity 확장

- 기존 `userId`, `activityType`, `details`, `occurredAt`, `createdAt`을 유지한다.
- 선택적 `productId`와 `Product` 관계를 추가한다.
- 상품 활동 조회를 위해 `(productId, activityType, occurredAt)` 복합 인덱스를 추가한다.
- 사용자별 시간 순서 판정을 위해 `(userId, productId, occurredAt)` 복합 인덱스를 추가한다.
- 기존 `activityType` 컬럼은 문자열로 유지해 마이그레이션 위험을 줄이고, 허용 값은 공통
  Zod 스키마가 관리한다.

상품 관계의 삭제 정책은 `Restrict`로 둔다. API는 소프트 삭제만 제공하므로 활동 이력이
가리키는 상품이 물리적으로 사라지지 않는다.

## 공통 활동 이벤트 계약

`libs/common-utils`에 다음 계약을 둔다.

- 활동 타입: `login`, `logout`, `view_product`, `add_to_cart`, `purchase`
- 공통 필드: `userId`, `activityType`, `productId?`, `details?`, `timestamp`
- `userId`와 `productId`는 UUID로 검증한다.
- `view_product`, `add_to_cart`, `purchase`에는 `productId`가 반드시 필요하다.
- `login`, `logout`에는 `productId`를 허용하지 않는다.

`api-server`의 요청 DTO와 `activity-worker`의 소비 검증이 같은 스키마를 사용한다. 생산자와
소비자의 규칙이 따로 변경되어 발생하는 스키마 드리프트를 방지한다.

## 애플리케이션 경계

### api-server

`POST /activity/track`의 기존 URL과 응답은 유지한다. 공통 스키마 기반 DTO로 입력을
검증하고 SQS에 검증된 이벤트를 발행한다.

### activity-worker

공통 스키마로 메시지를 다시 검증한다. 검증된 `productId`를 `UserActivity`에 함께 저장한다.
알 수 없는 상품 ID는 외래 키 오류를 일으키며 메시지를 삭제하지 않아 기존 재시도 정책을
따른다. 유효하지 않은 메시지는 기존처럼 폐기한다.

### web-server

`TypedConfigModule`에 `databaseEnvSchema`를 병합하고 `PrismaModule`을 가져온다. 기존
`WidgetsModule`과 `/widgets` API는 제거한다.

#### 상품 API

- `POST /products`
- `GET /products?page=1&limit=20&search=...`
- `GET /products/:id`
- `PATCH /products/:id`
- `DELETE /products/:id`

목록은 삭제되지 않은 상품만 최신 생성 순으로 반환한다. 검색은 SKU와 상품명에
대소문자 구분 없이 적용한다. SKU 중복은 Prisma `P2002`를 `409 Conflict`로 변환한다.

#### 퍼널 API

`GET /admin/analytics/funnel`

필수 쿼리:

- `productId`: 분석할 상품 UUID
- `from`: ISO 8601 시작 시각
- `to`: ISO 8601 종료 시각

`from`은 `to`보다 앞서야 한다. 분석 대상 상품은 소프트 삭제 여부와 관계없이 조회할 수
있어 과거 상품의 성과를 보존한다.

응답 데이터:

- 상품 식별 정보와 분석 기간
- `viewedUsers`
- `addedToCartUsers`
- `purchasedUsers`
- `viewToCartRate`
- `cartToPurchaseRate`
- `overallPurchaseRate`

비율은 `0`부터 `1` 사이의 값으로 반환하고 소수점 넷째 자리에서 반올림한다. 분모가 0이면
비율은 0이다.

## 퍼널 계산 규칙

1. 지정 상품과 기간에 속한 세 이벤트를 `userId`, `occurredAt` 순으로 조회한다.
2. 사용자별로 첫 `view_product` 이후의 `add_to_cart`만 다음 단계로 인정한다.
3. 인정된 `add_to_cart` 이후의 `purchase`만 마지막 단계로 인정한다.
4. 한 사용자가 같은 단계를 여러 번 수행해도 사용자 수에는 한 번만 포함한다.
5. `addedToCartUsers`는 항상 `viewedUsers` 이하이고, `purchasedUsers`는 항상
   `addedToCartUsers` 이하가 된다.

현재 프로젝트 규모에서는 원본 이벤트를 한 번 읽어 상태 머신으로 계산한다. 데이터가
커지면 이 서비스 경계를 유지한 채 집계 테이블 구현으로 교체할 수 있다.

## 오류 처리

- 잘못된 UUID, 날짜, 요청 본문: `400 VALIDATION_FAILED`
- `from >= to`: `400 VALIDATION_FAILED`
- 없는 상품: `404 NOT_FOUND`
- 중복 SKU: `409 CONFLICT`
- 예상하지 못한 Prisma 오류: 공통 예외 필터가 `500`으로 변환

서비스는 Prisma 오류 전체를 숨기지 않는다. 비즈니스 의미가 명확한 고유 제약 위반만
`ConflictException`으로 매핑하고 나머지는 상위 공통 오류 처리기로 전달한다.

## 테스트 전략

- 공통 이벤트 스키마
  - 상품 이벤트에 `productId`가 없으면 실패
  - 로그인 이벤트에 `productId`가 있으면 실패
  - `purchase` 이벤트 성공
- 상품 서비스
  - 생성, 페이지네이션, 수정, 소프트 삭제
  - 없는 상품과 중복 SKU 오류
- 퍼널 서비스
  - 정상 순서의 전환 계산
  - 순서가 뒤바뀐 이벤트 제외
  - 중복 이벤트 사용자 중복 제거
  - 분모가 0인 비율
- web-server API
  - Prisma provider를 테스트 대역으로 교체
  - 표준 성공 봉투와 RFC 7807 오류 형식 유지
- 전체 검증
  - Prisma validate/generate
  - TypeScript 7 및 TypeScript 5 타입 검사
  - ESLint
  - 전체 Jest
  - 세 애플리케이션 빌드

## 마이그레이션과 호환성

기존 `UserActivity.productId`는 nullable이므로 기존 행은 그대로 유지된다. 저장소에 아직
Prisma 마이그레이션 이력이 없으므로 기존 `user_activities` 구조를 나타내는 baseline과
상품 관계를 추가하는 증분 마이그레이션을 각각 만든다. 새 DB는 두 마이그레이션을 순서대로
적용한다. 과거 `prisma db push`로 만든 DB는 baseline을 적용 완료로 표시한 뒤 증분
마이그레이션만 실행한다. 생성된 Prisma Client는 기존 정책대로 Git에 포함하지 않고,
마이그레이션 SQL과 ERD만 추적한다.

## 완료 기준

- 프로세스를 재시작해도 상품 데이터가 PostgreSQL에 유지된다.
- 실제 상품을 생성하고 세 활동 이벤트를 SQS로 전달하면 퍼널 API에서 순서에 맞는 전환 수가
  조회된다.
- 인메모리 `Widget` 코드와 README 예시가 남지 않는다.
- 새 코드에 명시적 `any`가 없고 모든 기존 품질 검사가 통과한다.
