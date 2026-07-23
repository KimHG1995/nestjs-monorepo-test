# NestJS Feature Module Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize all three NestJS applications so root modules compose domain feature modules under `src/modules` without changing public behavior.

**Architecture:** Each application keeps only `main.ts`, its root module, and cross-cutting configuration at the source root. Controllers, services, DTOs, and their unit tests move into domain feature modules that explicitly import the infrastructure modules they consume.

**Tech Stack:** NestJS 10, TypeScript 5/7 preview, Jest, Zod, Prisma 7, AWS SQS SDK.

## Global Constraints

- Preserve every HTTP route, response envelope, RFC 7807 error, SQS message, Prisma write, and environment variable.
- Keep Nest CLI application entrypoints and root module names unchanged.
- Put application business implementation under `apps/<app>/src/modules/<domain>`.
- Keep `main.ts`, the application root module, and `config` outside `modules`.
- Import infrastructure modules from the feature module that consumes them.
- Do not add application-internal barrel files.
- Do not add dependencies.
- Do not use explicit `any`.
- Use Node.js 24 through `mise exec --` for every npm, npx, and node command.

---

### Task 1: API Server Activity Feature Module

**Files:**

- Move: `apps/api-server/src/track-activity.dto.ts` → `apps/api-server/src/modules/activity/dto/track-activity.dto.ts`
- Move: `apps/api-server/src/api-server.controller.ts` → `apps/api-server/src/modules/activity/activity.controller.ts`
- Move: `apps/api-server/src/api-server.controller.spec.ts` → `apps/api-server/src/modules/activity/activity.controller.spec.ts`
- Move: `apps/api-server/src/api-server.service.ts` → `apps/api-server/src/modules/activity/activity.service.ts`
- Create: `apps/api-server/src/modules/activity/activity.module.ts`
- Modify: `apps/api-server/src/api-server.module.ts`

**Interfaces:**

- Produces: `ActivityModule`, `ActivityController`, `ActivityService`, `TrackActivityDto`.
- Consumes: `SqsClientModule`, `SqsClientService`, `ActivityEventSchema`.
- Preserves: `POST /activity/track`.

- [x] **Step 1: Move the DTO into the activity feature**

Move the existing DTO without changing its schema:

```ts
import { createZodDto } from 'nestjs-zod';

import { ActivityEventSchema } from '@app/common-utils';

export class TrackActivityDto extends createZodDto(ActivityEventSchema) {}
```

- [x] **Step 2: Rename and move the controller**

Create `activity.controller.ts` from the existing controller and use domain names:

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ActivityService } from './activity.service';
import { TrackActivityDto } from './dto/track-activity.dto';

@ApiTags('Activity Tracker')
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post('track')
  @ApiOperation({ summary: '새로운 사용자 활동 추적' })
  @ApiResponse({
    status: 201,
    description: '활동이 성공적으로 추적되었습니다.',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 입력 데이터입니다. (RFC 7807)',
  })
  trackActivity(@Body() trackActivityDto: TrackActivityDto) {
    return this.activityService.trackActivity(trackActivityDto);
  }
}
```

- [x] **Step 3: Rename and move the service**

Create `activity.service.ts` from the existing service:

```ts
import { Injectable } from '@nestjs/common';

import { SqsClientService } from '@app/sqs-client';

import { TrackActivityDto } from './dto/track-activity.dto';

@Injectable()
export class ActivityService {
  constructor(private readonly sqsClientService: SqsClientService) {}

  async trackActivity(
    activityData: TrackActivityDto,
  ): Promise<{ messageId: string }> {
    const result = await this.sqsClientService.sendMessage(
      activityData,
      activityData.userId,
    );

    return { messageId: result.MessageId };
  }
}
```

The existing `console.log` is removed because application logging is already provided by `AppLoggerModule`; request payloads should not be written directly to stdout.

- [x] **Step 4: Add the feature module and simplify the root module**

Create `activity.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { SqsClientModule } from '@app/sqs-client';

import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  imports: [SqsClientModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
```

Update `ApiServerModule` so it imports `ActivityModule` and no longer directly registers the controller, service, or `SqsClientModule`.

- [x] **Step 5: Move and update the controller unit test**

Move the test next to `ActivityController` and replace:

```ts
ApiServerController → ActivityController
ApiServerService → ActivityService
./track-activity.dto → ./dto/track-activity.dto
```

Keep both existing assertions for account and product activity events.

- [x] **Step 6: Verify the API Server feature**

Run:

```bash
mise exec -- npx jest \
  apps/api-server/src/modules/activity/activity.controller.spec.ts \
  --runInBand
mise exec -- npm run typecheck
mise exec -- npx eslint apps/api-server
```

Expected: 2 tests pass, TypeScript exits 0, and ESLint reports no errors.

- [x] **Step 7: Commit**

```bash
git add apps/api-server
git commit -m "refactor(api-server): organize activity feature module"
```

### Task 2: Activity Worker Consumer Feature Module

**Files:**

- Move: `apps/activity-worker/src/activity-worker.service.ts` → `apps/activity-worker/src/modules/activity-consumer/activity-consumer.service.ts`
- Move: `apps/activity-worker/src/activity-worker.service.spec.ts` → `apps/activity-worker/src/modules/activity-consumer/activity-consumer.service.spec.ts`
- Create: `apps/activity-worker/src/modules/activity-consumer/activity-consumer.module.ts`
- Modify: `apps/activity-worker/src/activity-worker.module.ts`

**Interfaces:**

- Produces: `ActivityConsumerModule`, `ActivityConsumerService`.
- Consumes: `SqsClientModule`, `PrismaModule`, global `ConfigService<ActivityWorkerEnv>`.
- Preserves: module-init polling, activity validation, persistence, retry, and deletion semantics.

- [x] **Step 1: Move and rename the consumer service**

Move the implementation and make these exact substitutions:

```ts
ActivityWorkerService → ActivityConsumerService
new Logger(ActivityWorkerService.name) → new Logger(ActivityConsumerService.name)
./config/env → ../../config/env
```

Do not change `onModuleInit`, `startPolling`, `processMessage`,
`deleteIfPossible`, or `stopPolling` behavior.

- [x] **Step 2: Add the consumer feature module**

Create `activity-consumer.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '@app/prisma-client';
import { SqsClientModule } from '@app/sqs-client';

import { ActivityConsumerService } from './activity-consumer.service';

@Module({
  imports: [PrismaModule, SqsClientModule],
  providers: [ActivityConsumerService],
})
export class ActivityConsumerModule {}
```

- [x] **Step 3: Simplify the worker root module**

Keep `TypedConfigModule.forRoot(activityWorkerEnvSchema)` and
`AppLoggerModule.forRoot()` in `ActivityWorkerModule`. Replace direct
`PrismaModule`, `SqsClientModule`, and service registration with:

```ts
imports: [
  TypedConfigModule.forRoot(activityWorkerEnvSchema),
  AppLoggerModule.forRoot(),
  ActivityConsumerModule,
];
```

- [x] **Step 4: Move and update the unit test**

Move the test next to the consumer service and replace all
`ActivityWorkerService` references with `ActivityConsumerService`.
Keep all four persistence, product relation, invalid-message, and retry tests.

- [x] **Step 5: Verify the worker feature**

Run:

```bash
mise exec -- npx jest \
  apps/activity-worker/src/modules/activity-consumer/activity-consumer.service.spec.ts \
  --runInBand
mise exec -- npm run typecheck
mise exec -- npx eslint apps/activity-worker
```

Expected: 4 tests pass, TypeScript exits 0, and ESLint reports no errors.

- [x] **Step 6: Commit**

```bash
git add apps/activity-worker
git commit -m "refactor(worker): isolate activity consumer module"
```

### Task 3: Web Server Feature Module Layout

**Files:**

- Move: `apps/web-server/src/products/**` → `apps/web-server/src/modules/products/**`
- Move: `apps/web-server/src/admin/analytics/**` → `apps/web-server/src/modules/admin/analytics/**`
- Move: `apps/web-server/src/health/health.controller.ts` → `apps/web-server/src/modules/health/health.controller.ts`
- Create: `apps/web-server/src/modules/health/health.module.ts`
- Modify: `apps/web-server/src/modules/products/products.module.ts`
- Modify: `apps/web-server/src/modules/admin/analytics/analytics.module.ts`
- Modify: `apps/web-server/src/web-server.module.ts`

**Interfaces:**

- Produces: `ProductsModule`, `AnalyticsModule`, `HealthModule` under `src/modules`.
- Consumes: `PrismaModule` explicitly from product and analytics features.
- Preserves: all product, funnel, and health routes and response semantics.

- [x] **Step 1: Move products without changing behavior**

Move the complete products directory to `src/modules/products`. Relative
imports remain valid because DTOs, service, controller, module, and tests move
together.

- [x] **Step 2: Make the product infrastructure dependency explicit**

Update `products.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '@app/prisma-client';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

- [x] **Step 3: Move admin analytics without changing behavior**

Move the complete analytics directory to `src/modules/admin/analytics`.
Keep its DTO, calculator, service, controller, module, and tests together.

- [x] **Step 4: Make the analytics infrastructure dependency explicit**

Update `analytics.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { PrismaModule } from '@app/prisma-client';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
```

- [x] **Step 5: Encapsulate the health controller**

Move `health.controller.ts` into `src/modules/health` and create:

```ts
import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [x] **Step 6: Simplify the Web Server root module**

Remove direct `PrismaModule` and `HealthController` registration. Import:

```ts
import { AnalyticsModule } from './modules/admin/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { ProductsModule } from './modules/products/products.module';
```

The root `imports` must contain common infrastructure followed by the three
feature modules:

```ts
imports: [
  TypedConfigModule.forRoot(webServerEnvSchema),
  AppLoggerModule.forRoot(),
  HttpProtocolModule,
  ProductsModule,
  AnalyticsModule,
  HealthModule,
];
```

- [x] **Step 7: Verify Web Server unit and e2e tests**

Run:

```bash
mise exec -- npx jest apps/web-server/src/modules --runInBand
mise exec -- npx jest \
  --config apps/web-server/test/jest-e2e.json \
  --runInBand
mise exec -- npm run typecheck
mise exec -- npx eslint apps/web-server
```

Expected: 12 unit tests and 4 e2e tests pass, TypeScript exits 0, and ESLint
reports no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web-server
git commit -m "refactor(web): organize feature modules"
```

### Task 4: Architecture Documentation and Full Verification

**Files:**

- Modify: `README.md`
- Verify: all `apps/*/src/**`

**Interfaces:**

- Documents: the common application source layout and feature-module dependency rule.
- Verifies: no behavior regressions and no business implementation outside `src/modules`.

- [ ] **Step 1: Document the application source convention**

Add this structure to the README project-structure section:

```text
apps/<app>/src/
├── config/               # 앱 환경변수 스키마
├── modules/              # 도메인 기능 모듈
│   └── <feature>/
│       ├── dto/
│       ├── *.controller.ts
│       ├── *.service.ts
│       └── *.module.ts
├── <app>.module.ts       # 루트 조립 모듈
└── main.ts               # Nest 엔트리포인트
```

Document that root modules compose features and feature modules own their
controllers, services, DTOs, tests, and consumed infrastructure modules.

- [ ] **Step 2: Verify source placement**

Run:

```bash
if find apps -path '*/src/*' -type f |
  rg -v 'apps/[^/]+/src/(main\.ts|[^/]+\.module\.ts|config/|modules/)'; then
  exit 1
fi
```

Expected: no output and exit 0.

Run:

```bash
if rg -n '(:\s*any\b|<any>|as\s+any\b|any\[\])' apps; then
  exit 1
fi
```

Expected: no explicit `any`.

- [ ] **Step 3: Run full verification**

Run:

```bash
mise exec -- npm run typecheck
mise exec -- npm run typecheck:tsc
mise exec -- npx eslint .
mise exec -- npm test -- --runInBand
mise exec -- npm run test:e2e -- --runInBand
mise exec -- npx jest \
  --config apps/web-server/test/jest-e2e.json \
  --runInBand
mise exec -- npm run build:all
mise exec -- npm run build
git diff --check
```

Expected:

- TypeScript 7 and TypeScript 5 exit 0.
- ESLint reports zero errors.
- All unit and e2e tests pass.
- API Server, Activity Worker, Web Server, and the default build compile.
- Git reports no whitespace errors.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md
git commit -m "docs: document NestJS app module layout"
```

- [ ] **Step 5: Confirm final repository state**

Run:

```bash
git status --short --branch
git log -6 --oneline
```

Expected: a clean branch containing the design, implementation plan, three
application refactor commits, and documentation commit. Do not push without
explicit user authorization.
