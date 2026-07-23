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
