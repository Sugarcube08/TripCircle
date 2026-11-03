import { describe, expect, it } from 'vitest';
import { UpdatePaymentSchema } from '@tripcircle/contracts';

describe('UpdatePaymentSchema', () => {
  it.each(['UPI', 'CASH', 'OTHER'] as const)('accepts a valid %s payment update', (paymentMethod) => {
    const result = UpdatePaymentSchema.safeParse({
      amountPaise: 12550,
      paymentMethod,
      note: 'Updated transfer reference',
    });
    expect(result.success).toBe(true);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid amount %s', (amountPaise) => {
    const result = UpdatePaymentSchema.safeParse({ amountPaise, paymentMethod: 'UPI' });
    expect(result.success).toBe(false);
  });

  it('rejects notes longer than 500 characters', () => {
    const result = UpdatePaymentSchema.safeParse({
      amountPaise: 100,
      paymentMethod: 'CASH',
      note: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
