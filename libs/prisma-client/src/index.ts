export * from './prisma.module';
export * from './prisma.service';
// 생성된 Prisma 타입을 편의상 함께 재노출합니다. (`prisma generate` 이후 사용 가능)
export { Prisma } from '../generated/prisma/client';
export type { Product, UserActivity } from '../generated/prisma/client';
