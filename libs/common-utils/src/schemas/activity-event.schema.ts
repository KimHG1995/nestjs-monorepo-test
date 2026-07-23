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

const productActivityTypes: ReadonlySet<string> = new Set(
  PRODUCT_ACTIVITY_TYPES,
);

export const ActivityEventSchema = z
  .object({
    userId: z.string().uuid('userId에 유효하지 않은 UUID 형식입니다.'),
    activityType: z.enum(ACTIVITY_TYPES),
    productId: z
      .string()
      .uuid('productId에 유효하지 않은 UUID 형식입니다.')
      .optional(),
    details: JsonObjectSchema.optional(),
    timestamp: z
      .string()
      .datetime({ message: '유효하지 않은 ISO 8601 날짜/시간 형식입니다.' }),
  })
  .strict()
  .superRefine((activity, context) => {
    const isProductActivity = productActivityTypes.has(activity.activityType);

    if (isProductActivity && !activity.productId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '상품 활동에는 productId가 필요합니다.',
        path: ['productId'],
      });
    }

    if (!isProductActivity && activity.productId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '계정 활동에는 productId를 지정할 수 없습니다.',
        path: ['productId'],
      });
    }
  })
  .describe('사용자 활동 이벤트');

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
