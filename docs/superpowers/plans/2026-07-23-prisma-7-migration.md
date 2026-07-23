# Prisma 7 and TypeScript 7 Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the NestJS monorepo from Prisma 5 to Prisma 7 with an explicit PostgreSQL driver adapter and generated Client path, while removing the TypeScript `baseUrl` configuration that TS 7 rejects.

**Architecture:** Keep the existing NestJS CommonJS/Webpack boundary and generate a CommonJS-compatible Prisma Client into `libs/prisma-client/generated/prisma`. Centralize Prisma CLI paths and the migration URL in root `prisma.config.ts`; at runtime, construct `PrismaPg` from the already validated Nest `ConfigService`. Keep generated sources untracked and make local, CI, and Docker builds regenerate them deterministically.

**Tech Stack:** NestJS 10, Prisma ORM 7, `@prisma/adapter-pg`, PostgreSQL `pg`, Zod-backed `@nestjs/config`, TypeScript 5.9, native TypeScript 7 preview, Jest, Webpack, Docker

## Global Constraints

- Keep the NestJS monorepo and generated Prisma Client in CommonJS format; do not convert the repository to ESM.
- Do not change Prisma models, database tables, or migration SQL.
- Do not introduce explicit `any`, `z.any()`, or unnecessary non-null assertions.
- Read `DATABASE_URL` through `ConfigService<CommonEnv & DatabaseEnv, true>` at application runtime.
- Keep Prisma CLI generation usable without a live database or committed `.env` file.
- Keep `libs/prisma-client/generated/prisma/**` ignored and regenerate it from `schema.prisma`.
- Preserve the existing development/production Prisma log policy and Nest lifecycle hooks.
- Use Conventional Commits and do not push or create a PR without explicit authorization.

---

### Task 1: Unify TypeScript 5.9 and TypeScript 7 path resolution

**Files:**

- Modify: `tsconfig.json`
- Modify: `tsconfig.typecheck.json`

**Interfaces:**

- Consumes: existing `@app/*` aliases rooted at the repository directory
- Produces: `paths` entries that both `tsc` 5.9 and `tsgo` 7 resolve without `baseUrl`

- [ ] **Step 1: Re-run the failing native TypeScript 7 check**

Run:

```bash
npx tsgo --noEmit -p tsconfig.json
```

Expected: FAIL with `TS5102` for removed `baseUrl` and `TS5090` for each non-relative `paths` target.

- [ ] **Step 2: Remove `baseUrl` and make every path target explicitly relative**

In `tsconfig.json`, delete:

```json
"baseUrl": "./",
```

Replace the `paths` block with:

```json
"paths": {
  "@app/sqs-client": ["./libs/sqs-client/src"],
  "@app/sqs-client/*": ["./libs/sqs-client/src/*"],
  "@app/common-utils": ["./libs/common-utils/src"],
  "@app/common-utils/*": ["./libs/common-utils/src/*"],
  "@app/config": ["./libs/config/src"],
  "@app/config/*": ["./libs/config/src/*"],
  "@app/logger": ["./libs/logger/src"],
  "@app/logger/*": ["./libs/logger/src/*"],
  "@app/prisma-client": ["./libs/prisma-client/src"],
  "@app/prisma-client/*": ["./libs/prisma-client/src/*"]
}
```

In `tsconfig.typecheck.json`, replace the introductory comment with:

```text
// Go 네이티브 TypeScript(tsgo, TS 7)용 타입체크 전용 설정입니다.
// `npm run typecheck` → `tsgo --noEmit -p tsconfig.typecheck.json`
//
// 테스트 파일과 emit 옵션을 제외한 운영 소스 타입 검사를 빠르게 수행합니다.
// 경로 별칭은 루트 tsconfig.json과 동일하게 baseUrl 없이 상대경로를 사용합니다.
```

- [ ] **Step 3: Verify both compilers and the alias consumers**

Run:

```bash
npx tsgo --noEmit -p tsconfig.json
npm run typecheck
npm run typecheck:tsc
npm test -- --runInBand
npm run build:all
```

Expected: every command exits 0; Jest reports 3 passing suites and 14 passing tests before Prisma test additions.

- [ ] **Step 4: Commit the path migration**

```bash
git add tsconfig.json tsconfig.typecheck.json
git commit -m "chore(config): migrate TypeScript path aliases"
```

Expected: commit hook typecheck and tests pass.

---

### Task 2: Migrate the Prisma configuration and runtime to Prisma 7

**Files:**

- Create: `prisma.config.ts`
- Create: `libs/prisma-client/src/prisma.service.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `libs/prisma-client/prisma/schema.prisma`
- Modify: `libs/prisma-client/src/prisma.service.ts`
- Modify: `libs/prisma-client/src/index.ts`
- Generated but ignored: `libs/prisma-client/generated/prisma/**`
- Generated and tracked when changed: `libs/prisma-client/ERD.md`

**Interfaces:**

- Consumes: `CommonEnv`, `DatabaseEnv`, and the validated `DATABASE_URL` provided by global `TypedConfigModule`
- Produces: `PrismaService extends PrismaClient`, `Prisma`, and `UserActivity` through the existing `@app/prisma-client` public entry point
- Runtime constructor: `new PrismaService(configService: ConfigService<CommonEnv & DatabaseEnv, true>)`

- [ ] **Step 1: Confirm the Prisma 7 schema failure before migration**

Run from the repository root:

```bash
npx --yes prisma@7 validate --schema libs/prisma-client/prisma/schema.prisma
```

Expected: FAIL because datasource property `url` is not supported in Prisma 7 schema files.

- [ ] **Step 2: Install the Prisma 7 runtime and development dependencies without running the old postinstall**

Run:

```bash
npm install --ignore-scripts @prisma/client@7 @prisma/adapter-pg@7 pg dotenv
npm install --ignore-scripts --save-dev prisma@7 prisma-erd-generator@2 @types/pg
```

Expected: `package.json` and `package-lock.json` update; `npm ls prisma @prisma/client @prisma/adapter-pg pg dotenv prisma-erd-generator` has no invalid peer dependency.

- [ ] **Step 3: Add the root Prisma CLI configuration**

Create `prisma.config.ts`:

```typescript
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'libs/prisma-client/prisma/schema.prisma',
  migrations: {
    path: 'libs/prisma-client/prisma/migrations',
  },
  datasource: {
    // Client 생성에는 DB 연결이 필요하지 않으므로 fresh install에서도 config를 읽을 수 있어야 합니다.
    url: process.env.DATABASE_URL ?? '',
  },
});
```

- [ ] **Step 4: Switch the schema to the generated-source Prisma Client**

Replace the Client generator and datasource in `libs/prisma-client/prisma/schema.prisma` with:

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}
```

Keep the ERD generator and every model unchanged.

- [ ] **Step 5: Make package scripts use `prisma.config.ts` as the single path source**

Set these `package.json` scripts:

```json
"prisma:generate": "prisma generate",
"prisma:erd": "prisma generate --generator erd",
"prisma:migrate": "prisma migrate dev",
"prisma:studio": "prisma studio",
"db:push": "prisma db push",
"postinstall": "prisma generate --generator client"
```

Do not add a database operation to `postinstall`.

- [ ] **Step 6: Generate the Prisma 7 Client and validate the migrated schema**

Run:

```bash
npm run prisma:generate
npx prisma validate
```

Expected: both commands exit 0; generated Client exists at `libs/prisma-client/generated/prisma/client.ts`; ERD generation succeeds.

- [ ] **Step 7: Write a failing service construction test**

Create `libs/prisma-client/src/prisma.service.spec.ts`:

```typescript
import { ConfigService } from '@nestjs/config';

import type { CommonEnv, DatabaseEnv } from '@app/config';

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('검증된 데이터베이스 URL로 Prisma Client를 생성한다', async () => {
    const configService = new ConfigService<CommonEnv & DatabaseEnv, true>({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/app?schema=public',
    });

    const service = new PrismaService(configService);

    expect(service).toBeInstanceOf(PrismaService);
    await service.onModuleDestroy();
  });
});
```

- [ ] **Step 8: Run the focused test and verify RED**

Run:

```bash
npm test -- --runInBand libs/prisma-client/src/prisma.service.spec.ts
```

Expected: FAIL because the existing service still imports `@prisma/client`, accepts no `ConfigService`, and does not construct `PrismaPg`.

- [ ] **Step 9: Initialize Prisma Client with the typed PostgreSQL adapter**

Replace `libs/prisma-client/src/prisma.service.ts` with:

```typescript
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type { CommonEnv, DatabaseEnv } from '@app/config';

import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService<CommonEnv & DatabaseEnv, true>) {
    const databaseUrl = configService.get('DATABASE_URL', { infer: true });
    const nodeEnv = configService.get('NODE_ENV', { infer: true });
    const adapter = new PrismaPg({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5_000,
    });

    super({
      adapter,
      log:
        nodeEnv === 'production'
          ? ['warn', 'error']
          : ['query', 'warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('데이터베이스에 연결되었습니다.');
    } catch (error) {
      this.logger.error('데이터베이스 연결에 실패했습니다.', error as Error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

This preserves the existing error and lifecycle policy. Do not replace `error as Error` with `any`; changing the error contract is outside this migration.

- [ ] **Step 10: Re-export generated Prisma symbols from the library boundary**

Set `libs/prisma-client/src/index.ts` to:

```typescript
export * from './prisma.module';
export * from './prisma.service';
export { Prisma } from '../generated/prisma/client';
export type { UserActivity } from '../generated/prisma/client';
```

- [ ] **Step 11: Verify the focused test and Prisma consumers are GREEN**

Run:

```bash
npm test -- --runInBand libs/prisma-client/src/prisma.service.spec.ts
npm run typecheck
npm run typecheck:tsc
npx eslint libs/prisma-client/src prisma.config.ts
npm run build:all
```

Expected: focused test passes; the total repository test count increases by one; both typecheck commands, ESLint, and all three application builds exit 0.

- [ ] **Step 12: Confirm no legacy Prisma imports or schema URL remain**

Run:

```bash
rg -n "from '@prisma/client'|url\s*=\s*env\(" libs/prisma-client --glob '*.ts' --glob '*.prisma'
```

Expected: no matches. Imports inside ignored generated source are excluded by `.gitignore`-aware ripgrep defaults.

- [ ] **Step 13: Commit the vertical Prisma migration**

```bash
git add package.json package-lock.json prisma.config.ts libs/prisma-client/prisma/schema.prisma libs/prisma-client/src/prisma.service.ts libs/prisma-client/src/prisma.service.spec.ts libs/prisma-client/src/index.ts libs/prisma-client/ERD.md
git commit -m "feat(prisma): migrate to Prisma 7"
```

If `libs/prisma-client/ERD.md` is unchanged, omit it from `git add`. Expected: commit hook typecheck and all tests pass.

---

### Task 3: Make Docker generation deterministic and run release verification

**Files:**

- Modify: `Dockerfile`
- Modify: `.dockerignore`

**Interfaces:**

- Consumes: root `prisma.config.ts`, schema source, package lock, and Prisma `postinstall`
- Produces: application images that contain bundled generated Client code and runtime PostgreSQL adapter dependencies

- [ ] **Step 1: Record the pre-fix Docker behavior when Docker is available**

Run:

```bash
docker build --target builder --build-arg APP=activity-worker -t nestjs-monorepo-prisma7-builder-test .
```

Expected before the Dockerfile change: FAIL during `npm ci` because `prisma.config.ts` is not present for the Prisma 7 postinstall, or expose the obsolete `.prisma` packaging assumption. If Docker is unavailable, record that fact and continue with the deterministic file-level changes.

- [ ] **Step 2: Prevent host-generated sources from entering the Docker context**

Add this line to `.dockerignore` next to `node_modules` and `dist`:

```text
libs/prisma-client/generated
```

- [ ] **Step 3: Provide Prisma config before install and remove the obsolete runtime copy**

In the Docker builder dependency-copy block, use:

```dockerfile
COPY package*.json ./
COPY prisma.config.ts ./
COPY libs/prisma-client/prisma ./libs/prisma-client/prisma
RUN npm ci
```

Delete this runtime-stage line:

```dockerfile
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
```

Keep production dependency installation and `COPY --from=builder /app/dist ./dist` unchanged.

- [ ] **Step 4: Verify formatting, build behavior, and Docker when available**

Run:

```bash
npx prettier --check prisma.config.ts package.json libs/prisma-client/prisma/schema.prisma
git diff --check
npm run prisma:generate
npx prisma validate
npm run build:all
```

Expected: every command exits 0.

When Docker is available, also run:

```bash
docker build --build-arg APP=activity-worker -t nestjs-monorepo-prisma7-test .
```

Expected: image builds successfully without copying `node_modules/.prisma`.

- [ ] **Step 5: Commit Docker reproducibility changes**

```bash
git add Dockerfile .dockerignore
git commit -m "chore(docker): package Prisma 7 client"
```

Expected: commit hook typecheck and tests pass.

- [ ] **Step 6: Run the complete release verification**

Run:

```bash
npx prettier --check .
npx eslint .
npm run typecheck
npm run typecheck:tsc
npm test -- --runInBand
npm run build
npm run build:all
npx prisma validate
npm run prisma:generate
git diff --check
git status --short --branch
```

Expected:

- all commands exit 0;
- four Jest suites and at least 15 tests pass after the new Prisma service test;
- the default API build and all three explicit application builds succeed;
- Prisma validates and generates Client plus ERD successfully;
- no tracked working-tree changes remain;
- only the intended local commits are ahead of `origin/main`.

Optional integration verification, only when local Docker is available and using the repository's disposable Compose PostgreSQL is acceptable:

```bash
docker compose up -d postgres
npm run db:push
docker compose down
```

Expected: `db push` connects through the configured URL and reports the database is in sync. Preserve the named PostgreSQL volume; do not add `--volumes`.
