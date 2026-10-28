import { getEnv } from '../../../lib/env';
import { getSmtpTransporter, verifySmtpConnection } from './smtp.transport';
import { EmailTemplates, EmailTemplateResult } from './email.templates';

export class EmailService {
  /**
   * Internal sender with retry classification
   */
  private static async sendMail(to: string, template: EmailTemplateResult): Promise<{ messageId?: string; devMode?: boolean }> {
    const env = getEnv();

    // In automated testing environment, do not initiate external sockets
    if (env.NODE_ENV === 'test') {
      return { messageId: `mock-msg-${Date.now()}`, devMode: true };
    }

    const from = `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL || env.SMTP_USER || 'noreply@tripcircle.app'}>`;
    const isConfigured = Boolean(env.SMTP_USER && env.SMTP_PASSWORD);

    if (!isConfigured) {
      if (env.NODE_ENV === 'production') {
        throw new Error('SMTP credentials are not configured in production environment');
      }
      // Safe development fallback: log without sensitive credentials
      console.warn(`[DEV Email] Simulated delivery to: ${to} | Subject: ${template.subject}`);
      return { devMode: true };
    }

    try {
      const transporter = getSmtpTransporter();
      const info = await transporter.sendMail({
        from,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      return { messageId: info.messageId };
    } catch (err: any) {
      const isTransient =
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNRESET' ||
        err.responseCode === 421 ||
        err.responseCode === 450 ||
        err.responseCode === 451;

      console.error(
        `[Email Error] Delivery to ${to} failed: ${err.message} (Transient: ${isTransient})`
      );

      // In dev fallback cleanly so local workflows are not blocked
      if (env.NODE_ENV !== 'production') {
        console.warn(`[DEV Email Fallback] Email to ${to} failed, falling back to local simulation`);
        return { devMode: true };
      }

      throw err;
    }
  }

  /**
   * Account Verification or Password Reset OTP
   */
  static async sendOtpEmail(email: string, otp: string, purpose: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
    const template =
      purpose === 'PASSWORD_RESET'
        ? EmailTemplates.passwordResetOtp(otp)
        : EmailTemplates.accountVerificationOtp(otp);

    return this.sendMail(email, template);
  }

  /**
   * Password Reset with optional direct recovery web link
   */
  static async sendPasswordResetEmail(email: string, otp: string) {
    const env = getEnv();
    const resetUrl = `${env.APP_PUBLIC_URL}/reset-password?email=${encodeURIComponent(email)}`;
    const template = EmailTemplates.passwordResetOtp(otp, resetUrl);
    return this.sendMail(email, template);
  }

  /**
   * Trip Invitation
   */
  static async sendTripInvitationEmail(email: string, tripName: string, inviterName: string) {
    const env = getEnv();
    const appUrl = `${env.APP_PUBLIC_URL}/invitations`;
    const template = EmailTemplates.tripInvitation({ tripName, inviterName, appUrl });
    return this.sendMail(email, template);
  }

  /**
   * Payment Confirmation Request
   */
  static async sendPaymentConfirmationRequest(email: string, tripName: string, payerName: string, amountPaise: number) {
    const amountFormatted = `₹${(amountPaise / 100).toFixed(2)}`;
    const template = EmailTemplates.paymentConfirmationRequest({ tripName, payerName, amountFormatted });
    return this.sendMail(email, template);
  }

  /**
   * Payment Dispute
   */
  static async sendPaymentDisputed(email: string, tripName: string, receiverName: string, amountPaise: number, reason: string) {
    const amountFormatted = `₹${(amountPaise / 100).toFixed(2)}`;
    const template = EmailTemplates.paymentDisputed({ tripName, receiverName, amountFormatted, reason });
    return this.sendMail(email, template);
  }

  /**
   * Settlement Discount Proposal
   */
  static async sendDiscountProposal(email: string, tripName: string, fromMemberName: string, paidPaise: number, waivedPaise: number) {
    const paidFormatted = `₹${(paidPaise / 100).toFixed(2)}`;
    const waivedFormatted = `₹${(waivedPaise / 100).toFixed(2)}`;
    const template = EmailTemplates.discountProposal({ tripName, fromMemberName, paidFormatted, waivedFormatted });
    return this.sendMail(email, template);
  }

  /**
   * Safe transport check for health endpoint
   */
  static async verifyHealth(): Promise<{ connected: boolean; error?: string }> {
    return verifySmtpConnection();
  }
}
