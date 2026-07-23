# CodeRabbit Review Standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a schema-valid Korean CodeRabbit review policy and align the NestJS monorepo's source, ESLint, and TypeScript settings so explicit and implicit `any` cannot enter the codebase.

**Architecture:** CodeRabbit owns contextual, path-specific review guidance while repository-local ESLint and TypeScript settings enforce deterministic naming and type rules. A shared recursive JSON schema replaces `z.any()` at both producer and consumer boundaries, preserving the HTTP/SQS wire format while remaining assignable to Prisma JSON inputs.

**Tech Stack:** CodeRabbit schema v2, NestJS 10, TypeScript 5/7 (`tsc` and `tsgo`), ESLint Flat Config with `typescript-eslint`, Zod 3, Jest 29, Prisma 5, Prettier 3.

## Global Constraints

- Set CodeRabbit review comments and PR summaries to `ko-KR`.
- Do not use TypeScript `any`, `as any`, `Record<..., any>`, or `z.any()`; Jest `expect.any(...)` remains allowed because it is a runtime matcher.
- Reject implicit `any` in both `tsconfig.json` and `tsconfig.typecheck.json`.
- Preserve the existing HTTP request shape, SQS message JSON shape, and Prisma persistence behavior.
- Do not enable the full TypeScript `strict` family or change unrelated compiler options.
- Do not add CodeRabbit custom pre-merge checks that depend on a paid plan.
- Do not modify, format, unstage, or commit unrelated existing worktree changes.
- Use `git commit --only <paths>` for every task because the worktree already contains staged user changes.

---

## File Structure

- Create `.coderabbit.yaml`: repository-local CodeRabbit behavior, scope, tooling, and path-specific review instructions.
- Create `libs/common-utils/src/schemas/json-value.schema.ts`: one reusable recursive JSON type and Zod schemas.
- Create `libs/common-utils/src/schemas/json-value.schema.spec.ts`: JSON compatibility and rejection tests.
- Modify `libs/common-utils/src/index.ts`: expose the shared JSON schemas through the existing library entry point.
- Modify `apps/api-server/src/track-activity.dto.ts`: validate `details` with the shared JSON object schema.
- Modify `apps/activity-worker/src/activity-worker.service.ts`: validate consumed `details` with the same schema before Prisma persistence.
- Modify `libs/sqs-client/src/sqs-client.service.ts`: replace the unused `any`-bounded generic with an `object` parameter that accepts class DTOs.
- Modify `eslint.config.mjs`: reject explicit `any` and enforce project-compatible identifier formats.
- Modify `tsconfig.json`: reject implicit `any` in the TypeScript 5 toolchain.
- Modify `tsconfig.typecheck.json`: reject implicit `any` in the `tsgo` TypeScript 7 check.

---

### Task 1: Add the repository CodeRabbit policy

**Files:**

- Create: `.coderabbit.yaml`

**Interfaces:**

- Consumes: CodeRabbit configuration schema `https://coderabbit.ai/integrations/schema.v2.json`.
- Produces: schema-v2 configuration with Korean output, assertive automatic reviews, ESLint integration, exclusions, and six path-specific review scopes.

- [ ] **Step 1: Verify the configuration is currently missing**

Run:

```bash
test -f .coderabbit.yaml
```

Expected: exit code `1`, confirming that README's existing link has no target file.

- [ ] **Step 2: Create `.coderabbit.yaml` with the validated policy**

Create `.coderabbit.yaml` with exactly this content:

```yaml
# yaml-language-server: $schema=https://coderabbit.ai/integrations/schema.v2.json

language: ko-KR
tone_instructions: |
  모든 리뷰 코멘트와 요약을 간결하고 전문적인 한국어로 작성한다.
  문제의 근거와 실제 영향, 가장 작은 수정 방향을 함께 제시한다.
  단순 취향이나 ESLint가 이미 충분히 설명한 스타일 문제는 반복하지 않는다.
early_access: false
reviews:
  profile: assertive
  request_changes_workflow: true
  high_level_summary: true
  review_status: true
  in_progress_fortune: false
  poem: false
  path_filters:
    - '!**/dist/**'
    - '!**/coverage/**'
    - '!**/node_modules/**'
    - '!package-lock.json'
    - '!libs/prisma-client/ERD.md'
  path_instructions:
    - path: '**/*.ts'
      instructions: |
        - TypeScript `any`, `as any`, `Record<..., any>` 및 `z.any()`를 허용하지 않는다. Jest의 `expect.any(...)`는 타입이 아닌 런타임 매처이므로 허용한다.
        - 외부 또는 동적 입력은 `unknown`으로 받고 Zod 스키마, 타입 가드 또는 판별 가능한 유니온으로 좁힌다.
        - 불필요한 non-null assertion과 타입 단언을 지적한다.
        - 변수·함수·매개변수는 역할을 설명하는 camelCase, 타입은 PascalCase, 상수는 camelCase 또는 UPPER_CASE를 사용한다. 공개 스키마·생성자·데코레이터 역할의 상수는 PascalCase를 허용한다.
        - 인터페이스에 `I` 접두사를 붙이지 않는다. 문맥 없이 data, info, item, temp, value처럼 의미가 약한 이름을 사용하지 않는다.
        - 중복, 불필요한 추상화 및 과도한 범용화보다 작은 책임과 명확한 계약을 우선한다.
    - path: 'apps/**/src/**/*.ts'
      instructions: |
        - 컨트롤러는 HTTP 입출력 조정만 담당하고 비즈니스 로직은 서비스로 위임한다.
        - 외부 입력은 DTO 또는 Zod 스키마 경계에서 검증한다.
        - NestJS 의존성 주입을 사용하고 직접 인스턴스 생성과 숨은 전역 상태를 피한다.
        - 비동기 호출은 await, 반환 또는 명시적 오류 처리 중 하나를 갖춰야 한다.
        - 내부 오류, 민감정보 및 스택 트레이스를 외부 응답에 노출하지 않고 기존 RFC 7807 실패 응답 및 정형화된 성공 응답 계약을 보존한다.
        - Controller, Service, Module, DTO 이름과 파일 접미사가 실제 역할과 일치하는지 확인한다.
    - path: 'libs/**/src/**/*.ts'
      instructions: |
        - 공용 라이브러리는 특정 앱 구현에 의존하지 않아야 한다.
        - 공개 진입점은 필요한 심볼만 노출하고 내부 구현을 누출하지 않아야 한다.
        - 순환 의존성, 숨은 부작용 및 요청별 상태를 singleton provider에 저장하는 문제를 확인한다.
        - 재사용 가능한 계약과 앱별 정책을 분리하고 라이브러리 이름과 공개 API의 책임을 일치시킨다.
    - path: '**/*.{spec,e2e-spec}.ts'
      instructions: |
        - 테스트 이름은 조건과 기대 결과를 설명해야 한다.
        - 정상 경로뿐 아니라 실패, 경계값 및 회귀 조건을 검증한다.
        - 시간, 네트워크, 실행 순서 또는 공유 상태에 의존하는 비결정적 테스트를 피한다.
        - 내부 구현 호출 횟수보다 관찰 가능한 계약을 우선 검증한다.
        - Jest의 `expect.any(...)`는 허용하지만 테스트 변수와 응답 타입에 TypeScript `any`를 사용하지 않는다.
    - path: '{.github/**,Dockerfile,docker/**,docker-compose.yml}'
      instructions: |
        - 비밀정보와 자격 증명 노출을 확인한다.
        - GitHub Actions와 컨테이너 권한은 필요한 최소 범위로 제한한다.
        - 빌드는 버전과 입력을 고정해 재현 가능하게 유지한다.
        - 서비스 의존성, 헬스체크, 종료 처리 및 환경변수 기본값의 안전성을 확인한다.
    - path: 'libs/prisma-client/prisma/**'
      instructions: |
        - 관계, unique 제약, 인덱스, nullable 여부 및 삭제 동작이 도메인 불변식을 지키는지 확인한다.
        - 파괴적 스키마 변경과 이전 버전 호환 위험을 지적한다.
        - 자동 생성 결과가 아니라 원본 스키마와 마이그레이션을 검토한다.
  auto_review:
    enabled: true
    drafts: false
    ignore_title_keywords:
      - WIP
      - DO NOT MERGE
      - '[skip review]'
  tools:
    eslint:
      enabled: true

chat:
  art: false
  auto_reply: true
```

- [ ] **Step 3: Verify formatting and validate against the live CodeRabbit schema**

Run:

```bash
npx prettier --check .coderabbit.yaml
```

Expected: `All matched files use Prettier code style!`

Run:

```bash
curl -fsSL https://coderabbit.ai/integrations/schema.v2.json -o /tmp/coderabbit-schema.v2.json
```

Expected: exit code `0` and a non-empty `/tmp/coderabbit-schema.v2.json`.

Run:

```bash
node -e "const fs=require('fs'); const YAML=require('yaml'); const Ajv2020=require('ajv/dist/2020').default; const data=YAML.parse(fs.readFileSync('.coderabbit.yaml','utf8')); const schema=JSON.parse(fs.readFileSync('/tmp/coderabbit-schema.v2.json','utf8')); const ajv=new Ajv2020({allErrors:true,strict:false}); if(!ajv.validate(schema,data)){console.error(JSON.stringify(ajv.errors,null,2));process.exit(1)} console.log('CodeRabbit schema v2 validation: PASS');"
```

Expected: `CodeRabbit schema v2 validation: PASS`.

- [ ] **Step 4: Commit only the CodeRabbit configuration**

```bash
git add .coderabbit.yaml
git commit --only .coderabbit.yaml -m "chore: configure CodeRabbit reviews"
```

Expected: one commit containing only `.coderabbit.yaml`; all pre-existing staged paths remain staged.

---

### Task 2: Replace permissive payload types with a shared JSON contract

**Files:**

- Create: `libs/common-utils/src/schemas/json-value.schema.spec.ts`
- Create: `libs/common-utils/src/schemas/json-value.schema.ts`
- Modify: `libs/common-utils/src/index.ts`
- Modify: `apps/api-server/src/track-activity.dto.ts`
- Modify: `apps/activity-worker/src/activity-worker.service.ts`
- Modify: `libs/sqs-client/src/sqs-client.service.ts`

**Interfaces:**

- Produces: `JsonValue`, a recursive union of `string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }`.
- Produces: `JsonValueSchema: z.ZodType<JsonValue>` for any JSON-compatible value.
- Produces: `JsonObjectSchema`, an inferred `z.record(JsonValueSchema)` contract for object-valued `details` payloads.
- Consumes: `TrackActivityDto` instances as `object` in `SqsClientService.sendMessage(body: object, messageGroupId: string)`.

- [ ] **Step 1: Write the failing shared JSON schema tests**

Create `libs/common-utils/src/schemas/json-value.schema.spec.ts`:

```typescript
import { JsonObjectSchema, JsonValueSchema } from './json-value.schema';

describe('JsonValueSchema', () => {
  it('accepts nested JSON-compatible values', () => {
    const values: unknown[] = [
      null,
      'activity',
      42,
      true,
      ['nested', 1, false, null],
      { context: { source: 'web' }, tags: ['new'] },
    ];

    for (const value of values) {
      expect(JsonValueSchema.safeParse(value).success).toBe(true);
    }
  });

  it.each([
    undefined,
    BigInt(1),
    new Date('2026-07-23T00:00:00.000Z'),
    () => 'not-json',
    Symbol('not-json'),
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects non-JSON value %#', (value) => {
    expect(JsonValueSchema.safeParse(value).success).toBe(false);
  });
});

describe('JsonObjectSchema', () => {
  it('accepts a nested JSON object', () => {
    const details = {
      context: { source: 'web', authenticated: true },
      tags: ['new', null],
      attempt: 1,
    };

    expect(JsonObjectSchema.parse(details)).toEqual(details);
  });

  it('rejects a top-level array', () => {
    expect(JsonObjectSchema.safeParse(['not', 'an', 'object']).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npx jest libs/common-utils/src/schemas/json-value.schema.spec.ts --runInBand
```

Expected: FAIL with `Cannot find module './json-value.schema'`.

- [ ] **Step 3: Implement the recursive JSON schemas**

Create `libs/common-utils/src/schemas/json-value.schema.ts`:

```typescript
import { z } from 'zod';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const JsonObjectSchema = z.record(JsonValueSchema);
```

- [ ] **Step 4: Export the shared schema from the common-utils entry point**

Add this export to `libs/common-utils/src/index.ts`:

```typescript
export * from './schemas/json-value.schema';
```

Keep every existing export unchanged.

- [ ] **Step 5: Use the shared contract at producer and consumer boundaries**

Apply these exact changes to `apps/api-server/src/track-activity.dto.ts`:

```diff
 import { createZodDto } from 'nestjs-zod';
 import { z } from 'zod';

+import { JsonObjectSchema } from '@app/common-utils';
+
 const TrackActivitySchema = z.object({
   userId: z.string().uuid('userId에 유효하지 않은 UUID 형식입니다.'),
   activityType: z.enum(['login', 'logout', 'view_product', 'add_to_cart']),
-  details: z
-    .record(z.any())
-    .optional()
-    .describe('활동에 대한 추가적인 세부 정보'),
+  details: JsonObjectSchema.optional().describe(
+    '활동에 대한 추가적인 세부 정보',
+  ),
```

Use the exported object schema directly; do not reach into Zod's internal record definition.

Apply these exact changes to `apps/activity-worker/src/activity-worker.service.ts`:

```diff
 import { z } from 'zod';

+import { JsonObjectSchema } from '@app/common-utils';
 import { PrismaService } from '@app/prisma-client';
 import { SqsClientService } from '@app/sqs-client';
@@
-  details: z.record(z.any()).optional(),
+  details: JsonObjectSchema.optional(),
```

Apply this exact signature change to `libs/sqs-client/src/sqs-client.service.ts`:

```diff
-  async sendMessage<T extends Record<string, any>>(
-    body: T,
+  async sendMessage(
+    body: object,
     messageGroupId: string,
   ): Promise<SendMessageCommandOutput> {
```

- [ ] **Step 6: Run focused tests and fix only contract-related failures**

Run:

```bash
npx jest libs/common-utils/src/schemas/json-value.schema.spec.ts --runInBand
```

Expected: PASS with 1 suite and 10 tests.

Run:

```bash
npm run typecheck
```

Expected: exit code `0`; in particular, `activity.details` is assignable to the Prisma JSON input and `TrackActivityDto` is accepted by `sendMessage(body: object, ...)`.

Run:

```bash
npx eslint libs/common-utils/src/schemas/json-value.schema.ts libs/common-utils/src/schemas/json-value.schema.spec.ts libs/common-utils/src/index.ts apps/api-server/src/track-activity.dto.ts apps/activity-worker/src/activity-worker.service.ts libs/sqs-client/src/sqs-client.service.ts
```

Expected: exit code `0` with no diagnostics.

- [ ] **Step 7: Commit only the JSON contract changes**

```bash
git add libs/common-utils/src/schemas/json-value.schema.ts libs/common-utils/src/schemas/json-value.schema.spec.ts libs/common-utils/src/index.ts apps/api-server/src/track-activity.dto.ts apps/activity-worker/src/activity-worker.service.ts libs/sqs-client/src/sqs-client.service.ts
git commit --only libs/common-utils/src/schemas/json-value.schema.ts libs/common-utils/src/schemas/json-value.schema.spec.ts libs/common-utils/src/index.ts apps/api-server/src/track-activity.dto.ts apps/activity-worker/src/activity-worker.service.ts libs/sqs-client/src/sqs-client.service.ts -m "refactor: replace any with JSON-safe types"
```

Expected: one commit containing only the six listed paths; unrelated staged files remain staged.

---

### Task 3: Enforce naming and explicit/implicit `any` policies

**Files:**

- Modify: `eslint.config.mjs:33-40`
- Modify: `eslint.config.mjs:78-90`
- Modify: `tsconfig.json:16`
- Modify: `tsconfig.typecheck.json:18`

**Interfaces:**

- Consumes: the `JsonValue` cleanup from Task 2, so enabling `no-explicit-any` does not introduce known repository violations.
- Produces: ESLint errors for explicit `any` and invalid identifier formats.
- Produces: compiler errors for implicit `any` in both TypeScript configurations.

- [ ] **Step 1: Run policy assertions and verify the current settings fail them**

Run:

```bash
node -e "import('./eslint.config.mjs').then(({default:configs})=>{const rules=Object.assign({},...configs.map(config=>config.rules??{})); if(rules['@typescript-eslint/no-explicit-any']!=='error'||!rules['@typescript-eslint/naming-convention']) process.exit(1)})"
```

Expected: exit code `1` because `no-explicit-any` is currently `off` and naming convention is absent.

Run:

```bash
node -e "const ts=require('typescript'); for(const file of ['tsconfig.json','tsconfig.typecheck.json']){const config=ts.readConfigFile(file,ts.sys.readFile).config; if(config.compilerOptions.noImplicitAny!==true) process.exit(1)}"
```

Expected: exit code `1` because both files currently set `noImplicitAny` to `false`.

- [ ] **Step 2: Enable explicit `any` and identifier naming rules**

Replace the first rules block in `eslint.config.mjs` with:

```javascript
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        {
          selector: 'variable',
          format: ['camelCase'],
        },
        {
          selector: ['function', 'method'],
          format: ['camelCase'],
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
```

Replace the two-line comment immediately before the test-file override with:

```javascript
// 테스트에서는 supertest 응답 본문 등 외부 경계의 unsafe 접근 규칙만 완화합니다.
// 명시적 `any` 금지는 테스트에도 전역으로 유지합니다.
```

Do not add a test override for `no-explicit-any` or `naming-convention`.

- [ ] **Step 3: Reject implicit `any` in both compiler configurations**

Apply these exact changes:

```diff
--- a/tsconfig.json
+++ b/tsconfig.json
@@
-    "noImplicitAny": false,
+    "noImplicitAny": true,
--- a/tsconfig.typecheck.json
+++ b/tsconfig.typecheck.json
@@
-    "noImplicitAny": false,
+    "noImplicitAny": true,
```

- [ ] **Step 4: Re-run the policy assertions and verify they pass**

Run:

```bash
node -e "import('./eslint.config.mjs').then(({default:configs})=>{const rules=Object.assign({},...configs.map(config=>config.rules??{})); if(rules['@typescript-eslint/no-explicit-any']!=='error'||!rules['@typescript-eslint/naming-convention']) process.exit(1); console.log('ESLint type and naming policies: PASS')})"
```

Expected: `ESLint type and naming policies: PASS`.

Run:

```bash
node -e "const ts=require('typescript'); for(const file of ['tsconfig.json','tsconfig.typecheck.json']){const config=ts.readConfigFile(file,ts.sys.readFile).config; if(config.compilerOptions.noImplicitAny!==true) process.exit(1)} console.log('TypeScript noImplicitAny policies: PASS')"
```

Expected: `TypeScript noImplicitAny policies: PASS`.

- [ ] **Step 5: Verify ESLint detects an explicit `any` probe**

Run:

```bash
node -e "const {FlatESLint}=require('eslint/use-at-your-own-risk'); (async()=>{const eslint=new FlatESLint(); const [result]=await eslint.lintText('const payload: any = {};\nvoid payload;\n',{filePath:'apps/no-explicit-any.probe.ts'}); const violation=result.messages.some(message=>message.ruleId==='@typescript-eslint/no-explicit-any'); if(!violation) process.exit(1); console.log('Explicit any probe: REJECTED')})().catch(error=>{console.error(error);process.exit(1)})"
```

Expected: `Explicit any probe: REJECTED` without creating a probe file.

- [ ] **Step 6: Run the complete local quality gate**

Run each command separately:

```bash
npx prettier --check .coderabbit.yaml eslint.config.mjs tsconfig.json tsconfig.typecheck.json libs/common-utils/src/schemas/json-value.schema.ts libs/common-utils/src/schemas/json-value.schema.spec.ts libs/common-utils/src/index.ts apps/api-server/src/track-activity.dto.ts apps/activity-worker/src/activity-worker.service.ts libs/sqs-client/src/sqs-client.service.ts
```

Expected: `All matched files use Prettier code style!`

```bash
npx eslint .
```

Expected: exit code `0` with no diagnostics.

```bash
npm run typecheck
```

Expected: exit code `0` from `tsgo`.

```bash
npm run typecheck:tsc
```

Expected: exit code `0` from TypeScript 5.

```bash
npm test -- --runInBand
```

Expected: all unit test suites pass, including `json-value.schema.spec.ts`.

```bash
npm run build:all
```

Expected: all three NestJS applications build successfully.

```bash
rg -n -P '(:|<|,|=)\s*any\b|\bas\s+any\b|\bany\[\]|z\.any\(' apps libs -g '*.ts'
```

Expected: exit code `1` with no matches. Jest `expect.any(...)` does not match this syntax search and remains in the tests.

- [ ] **Step 7: Revalidate CodeRabbit configuration after all formatting**

Run:

```bash
node -e "const fs=require('fs'); const YAML=require('yaml'); const Ajv2020=require('ajv/dist/2020').default; const data=YAML.parse(fs.readFileSync('.coderabbit.yaml','utf8')); const schema=JSON.parse(fs.readFileSync('/tmp/coderabbit-schema.v2.json','utf8')); const ajv=new Ajv2020({allErrors:true,strict:false}); if(!ajv.validate(schema,data)){console.error(JSON.stringify(ajv.errors,null,2));process.exit(1)} console.log('CodeRabbit schema v2 validation: PASS');"
```

Expected: `CodeRabbit schema v2 validation: PASS`.

- [ ] **Step 8: Commit only the static policy changes**

```bash
git add eslint.config.mjs tsconfig.json tsconfig.typecheck.json
git commit --only eslint.config.mjs tsconfig.json tsconfig.typecheck.json -m "chore: enforce TypeScript type and naming rules"
```

Expected: one commit containing only the three policy files; unrelated staged paths remain staged.

- [ ] **Step 9: Audit final scope without changing the index**

Run:

```bash
git log -5 --oneline --decorate
git status --short --branch
git diff HEAD~3..HEAD --stat
```

Expected: three implementation commits follow the documentation commits; the implementation diff contains only the ten config/source/test paths listed in this plan. Pre-existing staged user changes remain visible in `git status` and are not included in those three commits.
