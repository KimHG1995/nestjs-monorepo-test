# Commerce Funnel Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory Widget example with PostgreSQL-backed product management and a product-specific `view_product → add_to_cart → purchase` funnel API.

**Architecture:** A shared Zod activity contract keeps the API producer and SQS consumer consistent. Prisma stores products and product-linked activity events; `web-server` exposes product CRUD and calculates a fixed funnel from ordered raw events through a pure state-machine function.

**Tech Stack:** NestJS 10, TypeScript 5/7 preview, Zod, Prisma 7, PostgreSQL, Jest, Supertest, SQS.

## Global Constraints

- Keep the existing `api-server → SQS → activity-worker → PostgreSQL` event flow.
- Replace the in-memory `/widgets` API; do not retain a second example CRUD.
- Use `priceInMinorUnits: number`; do not store money in floating-point fields.
- Use soft deletion for products and preserve historical activity relations.
- Do not add authentication, UI, orders, dynamic funnels, caching, or aggregate tables.
- Do not use explicit `any`; all new names must describe their business meaning.
- Keep Zod validation, the success envelope, RFC 7807 errors, and structured logging.
- Use Node.js 24 through `mise exec --` for every npm, npx, node, and Prisma command.

---

### Task 1: Shared commerce activity contract

**Files:**

- Create: `libs/common-utils/src/schemas/activity-event.schema.ts`
- Create: `libs/common-utils/src/schemas/activity-event.schema.spec.ts`
- Modify: `libs/common-utils/src/index.ts`
- Modify: `apps/api-server/src/track-activity.dto.ts`
- Modify: `apps/api-server/src/api-server.controller.spec.ts`

**Interfaces:**

- Produces: `ACTIVITY_TYPES`, `PRODUCT_ACTIVITY_TYPES`, `ProductActivityTypeSchema`, `ActivityEventSchema`, `ActivityEvent`.
- Produces: `TrackActivityDto` backed by `ActivityEventSchema`.
- Consumes later: `activity-worker` uses `ActivityEventSchema`; analytics uses `PRODUCT_ACTIVITY_TYPES` and `ProductActivityTypeSchema`.

- [ ] **Step 1: Write failing activity contract tests**

Create `libs/common-utils/src/schemas/activity-event.schema.spec.ts`:

```ts
import { ActivityEventSchema } from './activity-event.schema';

const baseActivity = {
  userId: '11111111-1111-1111-1111-111111111111',
  timestamp: '2026-07-23T00:00:00.000Z',
};

describe('ActivityEventSchema', () => {
  it.each(['view_product', 'add_to_cart', 'purchase'])(
    '%s 이벤트에는 productId가 필요하다',
    (activityType) => {
      const result = ActivityEventSchema.safeParse({
        ...baseActivity,
        activityType,
      });

      expect(result.success).toBe(false);
    },
  );

  it('구매 이벤트와 상품 ID를 허용한다', () => {
    const event = {
      ...baseActivity,
      activityType: 'purchase',
      productId: '22222222-2222-2222-2222-222222222222',
      details: { orderReference: 'ORDER-1' },
    };

    expect(ActivityEventSchema.parse(event)).toEqual(event);
  });

  it.each(['login', 'logout'])(
    '%s 이벤트에는 productId를 허용하지 않는다',
    (activityType) => {
      const result = ActivityEventSchema.safeParse({
        ...baseActivity,
        activityType,
        productId: '22222222-2222-2222-2222-222222222222',
      });

      expect(result.success).toBe(false);
    },
  );
});
```

- [ ] **Step 2: Run the new test and confirm RED**

Run:

```bash
mise exec -- npx jest libs/common-utils/src/schemas/activity-event.schema.spec.ts --runInBand
```

Expected: FAIL because `./activity-event.schema` does not exist.

- [ ] **Step 3: Implement the shared contract**

Create `libs/common-utils/src/schemas/activity-event.schema.ts`:

```ts
import { z } from 'zod';

import { JsonObjectSchema } from './json-value.schema';

export const ACTIVITY_TYPES = [
  'login',
  'logout',
  'view_product',
  'add_to_cart',
  'purchase',
] as const;

export const PRODUCT_ACTIVITY_TYPES = [
  'view_product',
  'add_to_cart',
  'purchase',
] as const;

export const ProductActivityTypeSchema = z.enum(PRODUCT_ACTIVITY_TYPES);

const activityEventBaseSchema = z.object({
  userId: z.string().uuid('userId에 유효하지 않은 UUID 형식입니다.'),
  details: JsonObjectSchema.optional(),
  timestamp: z
    .string()
    .datetime({ message: '유효하지 않은 ISO 8601 날짜/시간 형식입니다.' }),
});

const accountActivitySchema = activityEventBaseSchema.extend({
  activityType: z.enum(['login', 'logout']),
  productId: z.never().optional(),
});

const productActivitySchema = activityEventBaseSchema.extend({
  activityType: ProductActivityTypeSchema,
  productId: z.string().uuid('productId에 유효하지 않은 UUID 형식입니다.'),
});

export const ActivityEventSchema = z
  .discriminatedUnion('activityType', [
    accountActivitySchema,
    productActivitySchema,
  ])
  .describe('사용자 활동 이벤트');

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
```

Export it from `libs/common-utils/src/index.ts`:

```ts
export * from './schemas/activity-event.schema';
```

Replace `apps/api-server/src/track-activity.dto.ts` with:

```ts
import { createZodDto } from 'nestjs-zod';

import { ActivityEventSchema } from '@app/common-utils';

export class TrackActivityDto extends createZodDto(ActivityEventSchema) {}
```

Extend `apps/api-server/src/api-server.controller.spec.ts` with a product event assertion:

```ts
it('상품 활동의 productId를 SQS 메시지에 보존한다', async () => {
  mockSqs.sendMessage.mockResolvedValue({ MessageId: 'msg-product-1' });
  const dto = {
    userId: '11111111-1111-1111-1111-111111111111',
    activityType: 'view_product',
    productId: '22222222-2222-2222-2222-222222222222',
    timestamp: '2026-07-23T00:00:00.000Z',
  } as TrackActivityDto;

  await controller.trackActivity(dto);

  expect(mockSqs.sendMessage).toHaveBeenCalledWith(dto, dto.userId);
});
```

- [ ] **Step 4: Verify the contract and API tests are GREEN**

Run:

```bash
mise exec -- npx jest \
  libs/common-utils/src/schemas/activity-event.schema.spec.ts \
  apps/api-server/src/api-server.controller.spec.ts \
  --runInBand
mise exec -- npm run typecheck
```

Expected: both suites pass and TypeScript 7 preview exits 0.

- [ ] **Step 5: Commit**

```bash
git add \
  libs/common-utils/src/schemas/activity-event.schema.ts \
  libs/common-utils/src/schemas/activity-event.schema.spec.ts \
  libs/common-utils/src/index.ts \
  apps/api-server/src/track-activity.dto.ts \
  apps/api-server/src/api-server.controller.spec.ts
git commit -m "feat(activity): share commerce event contract"
```

### Task 2: Product schema and worker persistence

**Files:**

- Modify: `libs/prisma-client/prisma/schema.prisma`
- Create: `libs/prisma-client/prisma/migrations/20260723000000_baseline/migration.sql`
- Create: `libs/prisma-client/prisma/migrations/20260723001000_add_commerce_funnel/migration.sql`
- Modify: `libs/prisma-client/src/index.ts`
- Modify: `apps/activity-worker/src/activity-worker.service.ts`
- Modify: `apps/activity-worker/src/activity-worker.service.spec.ts`
- Regenerate, do not commit: `libs/prisma-client/generated/prisma/**`
- Regenerate and commit: `libs/prisma-client/ERD.md`

**Interfaces:**

- Produces: Prisma `Product` model and `PrismaService.product`.
- Produces: nullable `UserActivity.productId` and `UserActivity.product`.
- Consumes: Task 1 `ActivityEventSchema`.
- Produces later: product and analytics services query the generated Prisma delegates.

- [ ] **Step 1: Write the failing worker persistence test**

Add to `apps/activity-worker/src/activity-worker.service.spec.ts`:

```ts
it('상품 활동의 productId를 DB에 적재한다', async () => {
  const productMessage: Message = {
    MessageId: 'msg-product-1',
    ReceiptHandle: 'rh-product-1',
    Body: JSON.stringify({
      userId: '11111111-1111-1111-1111-111111111111',
      activityType: 'purchase',
      productId: '22222222-2222-2222-2222-222222222222',
      timestamp: '2026-07-23T00:00:00.000Z',
    }),
  };
  mockPrisma.userActivity.create.mockResolvedValue({
    id: 'activity-product-1',
  });

  await service.processMessage(productMessage);

  expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      productId: '22222222-2222-2222-2222-222222222222',
    }),
  });
});
```

- [ ] **Step 2: Run the worker test and confirm RED**

Run:

```bash
mise exec -- npx jest apps/activity-worker/src/activity-worker.service.spec.ts --runInBand
```

Expected: FAIL because `productId` is not passed to Prisma.

- [ ] **Step 3: Add the Prisma product schema**

Add the following model to `libs/prisma-client/prisma/schema.prisma`:

```prisma
model Product {
  id                String         @id @default(uuid())
  sku               String         @unique
  name              String
  priceInMinorUnits Int            @map("price_in_minor_units")
  currency          String         @default("KRW") @db.Char(3)
  stockQuantity     Int            @default(0) @map("stock_quantity")
  createdAt         DateTime       @default(now()) @map("created_at")
  updatedAt         DateTime       @updatedAt @map("updated_at")
  deletedAt         DateTime?      @map("deleted_at")
  activities        UserActivity[]

  @@index([deletedAt, createdAt])
  @@map("products")
}
```

Add the relation and indexes to `UserActivity`:

```prisma
productId String?  @map("product_id")
product   Product? @relation(fields: [productId], references: [id], onDelete: Restrict)

@@index([productId, activityType, occurredAt])
@@index([userId, productId, occurredAt])
```

Create `libs/prisma-client/prisma/migrations/20260723000000_baseline/migration.sql`:

```sql
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "details" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_activities_user_id_idx" ON "user_activities"("user_id");
CREATE INDEX "user_activities_activity_type_idx" ON "user_activities"("activity_type");
```

Create `libs/prisma-client/prisma/migrations/20260723001000_add_commerce_funnel/migration.sql`:

```sql
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_in_minor_units" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KRW',
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_activities" ADD COLUMN "product_id" TEXT;

CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE INDEX "products_deleted_at_created_at_idx"
ON "products"("deleted_at", "created_at");
CREATE INDEX "user_activities_product_id_activity_type_occurred_at_idx"
ON "user_activities"("product_id", "activity_type", "occurred_at");
CREATE INDEX "user_activities_user_id_product_id_occurred_at_idx"
ON "user_activities"("user_id", "product_id", "occurred_at");

ALTER TABLE "user_activities"
ADD CONSTRAINT "user_activities_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
```

Export the generated product type from `libs/prisma-client/src/index.ts`:

```ts
export type { Product, UserActivity } from '../generated/prisma/client';
```

- [ ] **Step 4: Generate and validate Prisma artifacts**

Run:

```bash
mise exec -- npm run prisma:generate
mise exec -- npx prisma validate
```

Expected: Prisma Client 7.9.0 and ERD generate successfully; schema is valid.

- [ ] **Step 5: Make the worker consume the shared contract**

In `apps/activity-worker/src/activity-worker.service.ts`, replace the local Zod schema imports and declaration with:

```ts
import { ActivityEventSchema } from '@app/common-utils';
```

Parse with:

```ts
const parsed = ActivityEventSchema.safeParse(JSON.parse(message.Body ?? '{}'));
```

Persist the product relationship:

```ts
const record = await this.prisma.userActivity.create({
  data: {
    userId: activity.userId,
    activityType: activity.activityType,
    productId: activity.productId,
    details: activity.details,
    occurredAt: new Date(activity.timestamp),
  },
});
```

- [ ] **Step 6: Verify worker persistence and Prisma types are GREEN**

Run:

```bash
mise exec -- npx jest apps/activity-worker/src/activity-worker.service.spec.ts --runInBand
mise exec -- npm run typecheck
mise exec -- npm run typecheck:tsc
```

Expected: worker tests pass and both type checks exit 0.

- [ ] **Step 7: Commit**

```bash
git add \
  libs/prisma-client/prisma/schema.prisma \
  libs/prisma-client/prisma/migrations \
  libs/prisma-client/ERD.md \
  libs/prisma-client/src/index.ts \
  apps/activity-worker/src/activity-worker.service.ts \
  apps/activity-worker/src/activity-worker.service.spec.ts
git commit -m "feat(prisma): add product activity schema"
```

### Task 3: PostgreSQL-backed product management API

**Files:**

- Create: `apps/web-server/src/products/dto/create-product.dto.ts`
- Create: `apps/web-server/src/products/dto/update-product.dto.ts`
- Create: `apps/web-server/src/products/dto/list-products.query.ts`
- Create: `apps/web-server/src/products/products.service.ts`
- Create: `apps/web-server/src/products/products.service.spec.ts`
- Create: `apps/web-server/src/products/products.controller.ts`
- Create: `apps/web-server/src/products/products.module.ts`

**Interfaces:**

- Consumes: `PrismaService.product`.
- Produces: `ProductsService.create`, `findAll`, `findOne`, `update`, `remove`.
- Produces: REST endpoints under `/products`.
- Produces later: analytics uses the product model directly, not `ProductsService`, so deleted products remain analyzable.

- [ ] **Step 1: Write failing product service tests**

Create `apps/web-server/src/products/products.service.spec.ts`:

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '@app/prisma-client';

import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const productDelegate = {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };
  let service: ProductsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: { product: productDelegate },
        },
      ],
    }).compile();

    service = moduleRef.get(ProductsService);
    jest.clearAllMocks();
  });

  it('SKU를 대문자로 정규화해 상품을 생성한다', async () => {
    productDelegate.create.mockResolvedValue({ id: 'product-1' });

    await service.create({
      sku: ' sku-001 ',
      name: '테스트 상품',
      priceInMinorUnits: 12000,
      currency: 'krw',
      stockQuantity: 3,
    });

    expect(productDelegate.create).toHaveBeenCalledWith({
      data: {
        sku: 'SKU-001',
        name: '테스트 상품',
        priceInMinorUnits: 12000,
        currency: 'KRW',
        stockQuantity: 3,
      },
    });
  });

  it('중복 SKU를 ConflictException으로 변환한다', async () => {
    productDelegate.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create({
        sku: 'SKU-001',
        name: '중복 상품',
        priceInMinorUnits: 1000,
        currency: 'KRW',
        stockQuantity: 0,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('삭제된 상품은 단건 조회에서 제외한다', async () => {
    productDelegate.findFirst.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('상품을 소프트 삭제한다', async () => {
    productDelegate.findFirst.mockResolvedValue({ id: 'product-1' });
    productDelegate.update.mockResolvedValue({ id: 'product-1' });

    await service.remove('product-1');

    expect(productDelegate.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run product tests and confirm RED**

Run:

```bash
mise exec -- npx jest apps/web-server/src/products/products.service.spec.ts --runInBand
```

Expected: FAIL because `ProductsService` does not exist.

- [ ] **Step 3: Add product DTO schemas**

Create `create-product.dto.ts`:

```ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProductSchema = z
  .object({
    sku: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(120),
    priceInMinorUnits: z.number().int().nonnegative(),
    currency: z.string().trim().length(3).default('KRW'),
    stockQuantity: z.number().int().nonnegative().default(0),
  })
  .strict();

export class CreateProductDto extends createZodDto(CreateProductSchema) {}
```

Create `update-product.dto.ts`:

```ts
import { createZodDto } from 'nestjs-zod';

import { CreateProductSchema } from './create-product.dto';

export const UpdateProductSchema = CreateProductSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '수정할 필드를 최소 한 개 이상 제공해야 합니다.' },
);

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
```

Create `list-products.query.ts`:

```ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
});

export class ListProductsQueryDto extends createZodDto(
  ListProductsQuerySchema,
) {}
```

- [ ] **Step 4: Implement `ProductsService`**

Create `products.service.ts`:

```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, PrismaService } from '@app/prisma-client';

import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products.query';
import { UpdateProductDto } from './dto/update-product.dto';

function isPrismaErrorCode(
  error: unknown,
  expectedCode: string,
): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === expectedCode
  );
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({
        data: {
          ...dto,
          sku: dto.sku.trim().toUpperCase(),
          currency: dto.currency.trim().toUpperCase(),
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException(`이미 사용 중인 SKU입니다: ${dto.sku}`);
      }
      throw error;
    }
  }

  async findAll(query: ListProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`상품을 찾을 수 없습니다: ${id}`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.sku ? { sku: dto.sku.trim().toUpperCase() } : {}),
          ...(dto.currency
            ? { currency: dto.currency.trim().toUpperCase() }
            : {}),
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException(`이미 사용 중인 SKU입니다: ${dto.sku}`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

- [ ] **Step 5: Implement controller and module**

Create `products.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SkipResponseTransform } from '@app/common-utils';

import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products.query';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipResponseTransform()
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.productsService.remove(id);
  }
}
```

Create `products.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

- [ ] **Step 6: Verify product API unit tests**

Run:

```bash
mise exec -- npx jest apps/web-server/src/products/products.service.spec.ts --runInBand
mise exec -- npm run typecheck
mise exec -- npx eslint apps/web-server/src/products
```

Expected: product tests pass, typecheck exits 0, and ESLint reports no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web-server/src/products
git commit -m "feat(web): add product management API"
```

### Task 4: Ordered product funnel analytics

**Files:**

- Create: `apps/web-server/src/admin/analytics/dto/funnel-query.dto.ts`
- Create: `apps/web-server/src/admin/analytics/funnel-calculator.ts`
- Create: `apps/web-server/src/admin/analytics/funnel-calculator.spec.ts`
- Create: `apps/web-server/src/admin/analytics/analytics.service.ts`
- Create: `apps/web-server/src/admin/analytics/analytics.service.spec.ts`
- Create: `apps/web-server/src/admin/analytics/analytics.controller.ts`
- Create: `apps/web-server/src/admin/analytics/analytics.module.ts`

**Interfaces:**

- Consumes: `PRODUCT_ACTIVITY_TYPES`, `ProductActivityTypeSchema`, and Prisma product/activity delegates.
- Produces: `calculateProductFunnel(activities)`.
- Produces: `AnalyticsService.getProductFunnel(query)`.
- Produces: `GET /admin/analytics/funnel`.

- [ ] **Step 1: Write failing pure funnel tests**

Create `funnel-calculator.spec.ts`:

```ts
import { calculateProductFunnel } from './funnel-calculator';

describe('calculateProductFunnel', () => {
  it('사용자별 올바른 시간 순서만 전환으로 계산한다', () => {
    const metrics = calculateProductFunnel([
      {
        userId: 'user-1',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:00:00Z'),
      },
      {
        userId: 'user-1',
        activityType: 'add_to_cart',
        occurredAt: new Date('2026-07-23T00:01:00Z'),
      },
      {
        userId: 'user-1',
        activityType: 'purchase',
        occurredAt: new Date('2026-07-23T00:02:00Z'),
      },
      {
        userId: 'user-2',
        activityType: 'add_to_cart',
        occurredAt: new Date('2026-07-23T00:00:00Z'),
      },
      {
        userId: 'user-2',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:01:00Z'),
      },
    ]);

    expect(metrics).toEqual({
      viewedUsers: 2,
      addedToCartUsers: 1,
      purchasedUsers: 1,
      viewToCartRate: 0.5,
      cartToPurchaseRate: 1,
      overallPurchaseRate: 0.5,
    });
  });

  it('중복 이벤트를 사용자 수에 한 번만 포함한다', () => {
    const metrics = calculateProductFunnel([
      {
        userId: 'user-1',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:00:00Z'),
      },
      {
        userId: 'user-1',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:01:00Z'),
      },
    ]);

    expect(metrics.viewedUsers).toBe(1);
    expect(metrics.viewToCartRate).toBe(0);
  });
});
```

- [ ] **Step 2: Run calculator tests and confirm RED**

Run:

```bash
mise exec -- npx jest \
  apps/web-server/src/admin/analytics/funnel-calculator.spec.ts \
  --runInBand
```

Expected: FAIL because `calculateProductFunnel` does not exist.

- [ ] **Step 3: Implement the pure calculator**

Create `funnel-calculator.ts`:

```ts
import type { z } from 'zod';

import { ProductActivityTypeSchema } from '@app/common-utils';

export type ProductActivityType = z.infer<typeof ProductActivityTypeSchema>;

export interface FunnelActivity {
  userId: string;
  activityType: ProductActivityType;
  occurredAt: Date;
}

export interface FunnelMetrics {
  viewedUsers: number;
  addedToCartUsers: number;
  purchasedUsers: number;
  viewToCartRate: number;
  cartToPurchaseRate: number;
  overallPurchaseRate: number;
}

type FunnelStage = 0 | 1 | 2 | 3;

const calculateRate = (numerator: number, denominator: number): number =>
  denominator === 0
    ? 0
    : Math.round((numerator / denominator) * 10_000) / 10_000;

export function calculateProductFunnel(
  activities: readonly FunnelActivity[],
): FunnelMetrics {
  const stagesByUser = new Map<string, FunnelStage>();
  const orderedActivities = [...activities].sort(
    (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
  );

  for (const activity of orderedActivities) {
    const stage = stagesByUser.get(activity.userId) ?? 0;
    if (activity.activityType === 'view_product' && stage === 0) {
      stagesByUser.set(activity.userId, 1);
    } else if (activity.activityType === 'add_to_cart' && stage === 1) {
      stagesByUser.set(activity.userId, 2);
    } else if (activity.activityType === 'purchase' && stage === 2) {
      stagesByUser.set(activity.userId, 3);
    }
  }

  const stages = [...stagesByUser.values()];
  const viewedUsers = stages.filter((stage) => stage >= 1).length;
  const addedToCartUsers = stages.filter((stage) => stage >= 2).length;
  const purchasedUsers = stages.filter((stage) => stage >= 3).length;

  return {
    viewedUsers,
    addedToCartUsers,
    purchasedUsers,
    viewToCartRate: calculateRate(addedToCartUsers, viewedUsers),
    cartToPurchaseRate: calculateRate(purchasedUsers, addedToCartUsers),
    overallPurchaseRate: calculateRate(purchasedUsers, viewedUsers),
  };
}
```

- [ ] **Step 4: Write failing analytics service tests**

Create `analytics.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '@app/prisma-client';

import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const productId = '22222222-2222-2222-2222-222222222222';
  const productDelegate = { findUnique: jest.fn() };
  const activityDelegate = { findMany: jest.fn() };
  let service: AnalyticsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            product: productDelegate,
            userActivity: activityDelegate,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AnalyticsService);
    jest.clearAllMocks();
  });

  it('삭제된 상품도 과거 퍼널을 조회한다', async () => {
    productDelegate.findUnique.mockResolvedValue({
      id: productId,
      sku: 'SKU-001',
      name: '분석 상품',
    });
    activityDelegate.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:00:00Z'),
      },
    ]);

    const result = await service.getProductFunnel({
      productId,
      from: '2026-07-23T00:00:00.000Z',
      to: '2026-07-24T00:00:00.000Z',
    });

    expect(productDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: productId },
      select: { id: true, sku: true, name: true },
    });
    expect(result.metrics.viewedUsers).toBe(1);
  });

  it('없는 상품은 NotFoundException을 던진다', async () => {
    productDelegate.findUnique.mockResolvedValue(null);

    await expect(
      service.getProductFunnel({
        productId,
        from: '2026-07-23T00:00:00.000Z',
        to: '2026-07-24T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 5: Add the query DTO and analytics service**

Create `funnel-query.dto.ts`:

```ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const FunnelQuerySchema = z
  .object({
    productId: z.string().uuid(),
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine((query) => new Date(query.from) < new Date(query.to), {
    message: 'from은 to보다 앞서야 합니다.',
    path: ['from'],
  });

export class FunnelQueryDto extends createZodDto(FunnelQuerySchema) {}
```

Create `analytics.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';

import {
  PRODUCT_ACTIVITY_TYPES,
  ProductActivityTypeSchema,
} from '@app/common-utils';
import { PrismaService } from '@app/prisma-client';

import { FunnelQueryDto } from './dto/funnel-query.dto';
import { calculateProductFunnel, FunnelActivity } from './funnel-calculator';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductFunnel(query: FunnelQueryDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: query.productId },
      select: { id: true, sku: true, name: true },
    });
    if (!product) {
      throw new NotFoundException(
        `상품을 찾을 수 없습니다: ${query.productId}`,
      );
    }

    const activities = await this.prisma.userActivity.findMany({
      where: {
        productId: query.productId,
        activityType: { in: [...PRODUCT_ACTIVITY_TYPES] },
        occurredAt: {
          gte: new Date(query.from),
          lte: new Date(query.to),
        },
      },
      orderBy: [{ userId: 'asc' }, { occurredAt: 'asc' }],
      select: { userId: true, activityType: true, occurredAt: true },
    });

    const funnelActivities: FunnelActivity[] = activities.flatMap(
      (activity) => {
        const activityType = ProductActivityTypeSchema.safeParse(
          activity.activityType,
        );
        return activityType.success
          ? [{ ...activity, activityType: activityType.data }]
          : [];
      },
    );

    return {
      product,
      period: { from: query.from, to: query.to },
      metrics: calculateProductFunnel(funnelActivities),
    };
  }
}
```

- [ ] **Step 6: Add controller and module**

Create `analytics.controller.ts`:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AnalyticsService } from './analytics.service';
import { FunnelQueryDto } from './dto/funnel-query.dto';

@ApiTags('Admin Analytics')
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('funnel')
  getProductFunnel(@Query() query: FunnelQueryDto) {
    return this.analyticsService.getProductFunnel(query);
  }
}
```

Create `analytics.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
```

- [ ] **Step 7: Verify analytics tests**

Run:

```bash
mise exec -- npx jest apps/web-server/src/admin/analytics --runInBand
mise exec -- npm run typecheck
mise exec -- npx eslint apps/web-server/src/admin
```

Expected: calculator and service tests pass; typecheck and ESLint exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/web-server/src/admin
git commit -m "feat(web): add product funnel analytics"
```

### Task 5: Web-server database integration and protocol e2e

**Files:**

- Modify: `apps/web-server/src/config/env.ts`
- Modify: `apps/web-server/src/web-server.module.ts`
- Modify: `apps/web-server/test/web-server.e2e-spec.ts`
- Delete: `apps/web-server/src/widgets/**`

**Interfaces:**

- Consumes: `databaseEnvSchema`, `PrismaModule`, `ProductsModule`, `AnalyticsModule`.
- Removes: all `/widgets` routes and in-memory storage.
- Verifies: product and funnel routes still use the common success envelope and RFC 7807 errors.

- [ ] **Step 1: Rewrite the e2e fixture to expect database features**

In `web-server.e2e-spec.ts`, provide a Prisma test double:

```ts
const productDelegate = {
  count: jest.fn(),
  create: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};
const userActivityDelegate = { findMany: jest.fn() };

const moduleFixture = await Test.createTestingModule({
  imports: [WebServerModule],
})
  .overrideProvider(PrismaService)
  .useValue({
    product: productDelegate,
    userActivity: userActivityDelegate,
  })
  .compile();
```

Replace Widget expectations with these cases:

```ts
it('POST /products는 생성된 상품을 성공 봉투로 반환한다', async () => {
  productDelegate.create.mockResolvedValue({
    id: productId,
    sku: 'SKU-001',
    name: '상품 A',
    priceInMinorUnits: 12000,
    currency: 'KRW',
    stockQuantity: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

  const response = await request(app.getHttpServer())
    .post('/products')
    .send({
      sku: 'sku-001',
      name: '상품 A',
      priceInMinorUnits: 12000,
      currency: 'krw',
      stockQuantity: 3,
    })
    .expect(201);

  expect(response.body).toMatchObject({
    success: true,
    data: { id: productId, sku: 'SKU-001' },
  });
});

it('잘못된 상품은 RFC 7807 검증 오류를 반환한다', async () => {
  const response = await request(app.getHttpServer())
    .post('/products')
    .send({ sku: '', name: '', priceInMinorUnits: -1 })
    .expect(400)
    .expect('Content-Type', /application\/problem\+json/);

  expect(response.body).toMatchObject({
    status: 400,
    code: 'VALIDATION_FAILED',
  });
});

it('GET /admin/analytics/funnel은 퍼널 지표를 성공 봉투로 반환한다', async () => {
  productDelegate.findUnique.mockResolvedValue({
    id: productId,
    sku: 'SKU-001',
    name: '상품 A',
  });
  userActivityDelegate.findMany.mockResolvedValue([]);

  const response = await request(app.getHttpServer())
    .get('/admin/analytics/funnel')
    .query({
      productId,
      from: '2026-07-23T00:00:00.000Z',
      to: '2026-07-24T00:00:00.000Z',
    })
    .expect(200);

  expect(response.body.data.metrics).toEqual({
    viewedUsers: 0,
    addedToCartUsers: 0,
    purchasedUsers: 0,
    viewToCartRate: 0,
    cartToPurchaseRate: 0,
    overallPurchaseRate: 0,
  });
});
```

Retain the `/health` no-envelope test.

- [ ] **Step 2: Run e2e and confirm RED**

Run:

```bash
mise exec -- npx jest --config apps/web-server/test/jest-e2e.json --runInBand
```

Expected: FAIL because product and analytics modules are not imported.

- [ ] **Step 3: Connect `web-server` to validated database config**

Change `webServerEnvSchema` to:

```ts
export const webServerEnvSchema = commonEnvSchema
  .merge(databaseEnvSchema)
  .merge(
    z.object({
      WEB_SERVER_PORT: intFromEnv(3002),
      HTTPS_ENABLED: boolFromEnv(false),
      HTTPS_KEY_PATH: z.string().optional(),
      HTTPS_CERT_PATH: z.string().optional(),
      CORS_ORIGIN: z.string().default('*'),
    }),
  );
```

Import `databaseEnvSchema` from `@app/config`.

Update `WebServerModule` imports:

```ts
imports: [
  TypedConfigModule.forRoot(webServerEnvSchema),
  AppLoggerModule.forRoot(),
  HttpProtocolModule,
  PrismaModule,
  ProductsModule,
  AnalyticsModule,
],
```

Delete `WidgetsModule` import and delete `apps/web-server/src/widgets/**`.

- [ ] **Step 4: Verify web-server e2e and all affected tests**

Run:

```bash
mise exec -- npx jest --config apps/web-server/test/jest-e2e.json --runInBand
mise exec -- npm test -- --runInBand
mise exec -- npm run typecheck
mise exec -- npm run typecheck:tsc
mise exec -- npx eslint .
```

Expected: web e2e, all unit tests, both type checks, and ESLint pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web-server
git commit -m "feat(web): replace widgets with database admin API"
```

### Task 6: Documentation and full verification

**Files:**

- Modify: `README.md`
- Modify: `.env.example`
- Verify: `libs/prisma-client/ERD.md`

**Interfaces:**

- Documents: product CRUD payloads, activity tracking with `productId`, purchase event, and funnel query.
- Documents: baseline migration handling for databases previously created with `prisma db push`.

- [ ] **Step 1: Update environment and migration documentation**

Change the `.env.example` database heading from activity-worker-only to:

```dotenv
# Database (activity-worker, web-server) — docker-compose postgres 기본값
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app?schema=public
```

Update README structure and examples to remove Widget references. Add:

```bash
# 상품 생성
curl -s http://localhost:3002/products -X POST \
  -H 'Content-Type: application/json' \
  -d '{"sku":"SKU-001","name":"상품 A","priceInMinorUnits":12000,"currency":"KRW","stockQuantity":10}'

# 상품 조회 이벤트 발행
curl -s http://localhost:3000/activity/track -X POST \
  -H 'Content-Type: application/json' \
  -d '{"userId":"11111111-1111-1111-1111-111111111111","activityType":"view_product","productId":"<생성된 상품 UUID>","timestamp":"2026-07-23T00:00:00.000Z"}'

# 퍼널 조회
curl -G -s http://localhost:3002/admin/analytics/funnel \
  --data-urlencode 'productId=<생성된 상품 UUID>' \
  --data-urlencode 'from=2026-07-23T00:00:00.000Z' \
  --data-urlencode 'to=2026-07-24T00:00:00.000Z'
```

Document that an existing database created with `prisma db push` must mark the baseline before applying the incremental migration:

```bash
npx prisma migrate resolve --applied 20260723000000_baseline
npm run prisma:migrate
```

Fresh databases run only `npm run prisma:migrate`.

- [ ] **Step 2: Verify generated artifacts and formatting**

Run:

```bash
mise exec -- npm run prisma:generate
mise exec -- npx prisma validate
mise exec -- npx prettier --check \
  README.md \
  .env.example \
  docs/superpowers/specs/2026-07-23-commerce-funnel-admin-design.md \
  docs/superpowers/plans/2026-07-23-commerce-funnel-admin.md
git diff --check
```

Expected: Prisma generation and validation succeed, formatting passes, and Git reports no whitespace errors.

- [ ] **Step 3: Run complete verification**

Run:

```bash
mise exec -- npm run typecheck
mise exec -- npm run typecheck:tsc
mise exec -- npx eslint .
mise exec -- npm test -- --runInBand
mise exec -- npx jest --config apps/web-server/test/jest-e2e.json --runInBand
mise exec -- npm run build:all
mise exec -- npm run build
```

Expected:

- TypeScript 7 preview: exit 0
- TypeScript 5: exit 0
- ESLint: zero errors
- All Jest suites: zero failures
- web-server e2e: zero failures
- `api-server`, `activity-worker`, and `web-server`: Webpack success
- default `npm run build`: Webpack success

- [ ] **Step 4: Confirm requirements and repository state**

Run:

```bash
if rg -n '\bany\b' \
  apps/web-server/src/products \
  apps/web-server/src/admin \
  libs/common-utils/src/schemas/activity-event.schema.ts; then
  exit 1
fi

if test -d apps/web-server/src/widgets; then
  exit 1
fi

git status --short
git diff --check
```

Expected: no explicit `any`, no Widget directory, and only the planned README/.env changes remain.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example libs/prisma-client/ERD.md
git commit -m "docs: document commerce funnel workflow"
```

- [ ] **Step 6: Final status**

Run:

```bash
git status --short --branch
git log -8 --oneline
```

Expected: clean `main` branch with the design, plan, implementation, tests, and documentation committed; do not push without explicit user authorization.
