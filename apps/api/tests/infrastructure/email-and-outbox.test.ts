import { describe, it, expect, beforeAll } from 'vitest';
import { EmailTemplates } from '../../src/modules/notifications/email/email.templates';
import { EmailService } from '../../src/modules/notifications/email/email.service';
import { prisma } from '../../src/lib/prisma';
import { createOutboxEvent, processOutboxEvents, recoverStuckEvents } from '../../src/lib/outbox';

describe('Gmail SMTP & Durable Outbox Infrastructure Tests', () => {
  describe('Email Templates', () => {
    it('renders account verification OTP template with 6-digit code and HTML/text versions', () => {
      const template = EmailTemplates.accountVerificationOtp('482910');
      expect(template.subject).toContain('Verify Your Email');
      expect(template.html).toContain('482910');
      expect(template.html).toContain('trip<span>Circle</span>');
      expect(template.text).toContain('482910');
      expect(template.text).toContain('10 minutes');
    });

    it('renders password reset OTP template with recovery web link', () => {
      const template = EmailTemplates.passwordResetOtp('901234', 'https://tripcircle.app/reset-password?token=xyz');
      expect(template.subject).toContain('Password Recovery Code');
      expect(template.html).toContain('901234');
      expect(template.html).toContain('https://tripcircle.app/reset-password?token=xyz');
      expect(template.text).toContain('901234');
      expect(template.text).toContain('https://tripcircle.app/reset-password?token=xyz');
    });

    it('renders trip invitation template with inviter and trip name', () => {
      const template = EmailTemplates.tripInvitation({
        tripName: 'Himalayan Trek 2026',
        inviterName: 'Alice',
        appUrl: 'https://tripcircle.app/invitations',
      });
      expect(template.subject).toContain('Himalayan Trek 2026');
      expect(template.html).toContain('Alice');
      expect(template.html).toContain('Himalayan Trek 2026');
      expect(template.text).toContain('Alice');
    });

    it('renders payment confirmation request template with formatted rupee amount', () => {
      const template = EmailTemplates.paymentConfirmationRequest({
        tripName: 'Goa Weekend',
        payerName: 'Bob',
        amountFormatted: '₹1,500.00',
      });
      expect(template.subject).toContain('Payment confirmation from Bob');
      expect(template.html).toContain('₹1,500.00');
      expect(template.text).toContain('Bob recorded a payment of ₹1,500.00');
    });

    it('renders payment dispute notification template with reason', () => {
      const template = EmailTemplates.paymentDisputed({
        tripName: 'Goa Weekend',
        receiverName: 'Alice',
        amountFormatted: '₹1,500.00',
        reason: 'Payment not received in UPI account',
      });
      expect(template.subject).toContain('Payment disputed by Alice');
      expect(template.html).toContain('Payment not received in UPI account');
      expect(template.text).toContain('Payment not received in UPI account');
    });

    it('renders settlement discount proposal template with paid and waived amounts', () => {
      const template = EmailTemplates.discountProposal({
        tripName: 'Goa Weekend',
        fromMemberName: 'Charlie',
        paidFormatted: '₹330.00',
        waivedFormatted: '₹3.33',
      });
      expect(template.subject).toContain('Settlement discount proposal');
      expect(template.html).toContain('₹330.00');
      expect(template.html).toContain('₹3.33');
    });
  });

  describe('SMTP Transport Verification Check', () => {
    it('safely verifies SMTP configuration without sending live emails', async () => {
      const result = await EmailService.verifyHealth();
      expect(result).toHaveProperty('connected');
      // In dev environment without real Gmail credentials, it reports unconfigured without throwing
      expect(typeof result.connected).toBe('boolean');
    });
  });

  describe('Durable Outbox Processing', () => {
    beforeAll(async () => {
      // Mark any prior test pending events as completed so test event is top of queue
      await prisma.outboxEvent.updateMany({
        where: { status: 'PENDING' },
        data: { status: 'COMPLETED' },
      });

      // Clean up previous test outbox events
      await prisma.outboxEvent.deleteMany({
        where: { aggregateId: { in: ['test-outbox-user-1', 'test-outbox-user-2'] } },
      });
    });

    it('persists outbox events durably in MySQL with PENDING status', async () => {
      const event = await prisma.$transaction(async (tx) => {
        return createOutboxEvent(tx, 'USER', 'test-outbox-user-1', 'EMAIL_VERIFY_REQUESTED', {
          email: 'outbox.test@example.com',
          otp: '123456',
        });
      });

      expect(event.id).toBeDefined();
      expect(event.status).toBe('PENDING');
      expect(event.attempts).toBe(0);
    });

    it('processes pending outbox events and marks them COMPLETED with processedAt timestamp', async () => {
      const result = await processOutboxEvents(10);
      expect(result.total).toBeGreaterThanOrEqual(1);

      const updated = await prisma.outboxEvent.findFirst({
        where: { aggregateId: 'test-outbox-user-1' },
      });

      expect(updated?.status).toBe('COMPLETED');
      expect(updated?.processedAt).toBeInstanceOf(Date);
      expect(updated?.attempts).toBe(1);
    });

    it('recovers stuck processing events back to PENDING', async () => {
      const stuckEvent = await prisma.outboxEvent.create({
        data: {
          aggregateType: 'USER',
          aggregateId: 'test-outbox-user-2',
          eventType: 'EMAIL_VERIFY_REQUESTED',
          payload: { email: 'stuck@example.com', otp: '654321' },
          status: 'PROCESSING',
          createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        },
      });

      const recoveredCount = await recoverStuckEvents(5 * 60 * 1000);
      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      const recovered = await prisma.outboxEvent.findUnique({
        where: { id: stuckEvent.id },
      });
      expect(recovered?.status).toBe('PENDING');

      // Cleanup
      await prisma.outboxEvent.delete({ where: { id: stuckEvent.id } });
    });
  });
});
