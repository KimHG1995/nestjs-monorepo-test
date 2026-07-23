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
