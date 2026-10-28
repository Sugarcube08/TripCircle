export interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
}

function baseHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>tripCircle</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background-color: #0f172a; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; color: #ffffff; letter-spacing: -0.5px; }
    .header span { color: #14b8a6; }
    .content { padding: 32px 24px; }
    .code-box { background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0f172a; margin: 24px 0; font-family: monospace; }
    .btn { display: inline-block; background-color: #0d9488; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; text-align: center; }
    .footer { padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>trip<span>Circle</span></h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated transactional message from tripCircle. Please do not reply directly to this email.</p>
      <p>&copy; ${new Date().getFullYear()} tripCircle. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

export const EmailTemplates = {
  accountVerificationOtp(otp: string): EmailTemplateResult {
    const subject = 'tripCircle — Verify Your Email Address';
    const content = `
      <h2 style="margin-top:0; color:#0f172a;">Welcome to tripCircle!</h2>
      <p>Thank you for registering. Please enter the verification code below in your mobile app to activate your account:</p>
      <div class="code-box">${otp}</div>
      <p style="color:#64748b; font-size:14px;">This code will expire in 10 minutes. If you did not create a tripCircle account, please ignore this message.</p>
    `;
    const text = `Welcome to tripCircle!\n\nYour 6-digit email verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not create a tripCircle account, you can safely ignore this message.`;
    return { subject, html: baseHtml(content), text };
  },

  passwordResetOtp(otp: string, resetUrl?: string): EmailTemplateResult {
    const subject = 'tripCircle — Password Recovery Code';
    const buttonHtml = resetUrl
      ? `<div style="text-align:center;"><a href="${resetUrl}" class="btn">Reset Password</a></div>`
      : '';
    const content = `
      <h2 style="margin-top:0; color:#0f172a;">Password Recovery Request</h2>
      <p>We received a request to reset the password for your tripCircle account. Use the code below to proceed:</p>
      <div class="code-box">${otp}</div>
      ${buttonHtml}
      <p style="color:#64748b; font-size:14px;">This code is valid for 10 minutes. If you did not request a password reset, please secure your account immediately.</p>
    `;
    const text = `tripCircle Password Recovery\n\nYour recovery code is: ${otp}\n\n${resetUrl ? `You can also reset via this link: ${resetUrl}\n\n` : ''}This code expires in 10 minutes. If you did not request this, please secure your account.`;
    return { subject, html: baseHtml(content), text };
  },

  tripInvitation(params: {
    tripName: string;
    inviterName: string;
    appUrl?: string;
  }): EmailTemplateResult {
    const subject = `You've been invited to join "${params.tripName}" on tripCircle`;
    const content = `
      <h2 style="margin-top:0; color:#0f172a;">You're Invited!</h2>
      <p><strong>${params.inviterName}</strong> invited you to join the trip <strong>"${params.tripName}"</strong> on tripCircle.</p>
      <p>tripCircle keeps shared trip expenses transparent, automatically calculates who owes whom, and simplifies settlements.</p>
      ${params.appUrl ? `<div style="text-align:center;"><a href="${params.appUrl}" class="btn">Open tripCircle</a></div>` : ''}
      <p style="color:#64748b; font-size:14px;">Log in to the tripCircle mobile app to accept your invitation.</p>
    `;
    const text = `${params.inviterName} has invited you to join "${params.tripName}" on tripCircle.\n\nOpen the tripCircle app to accept your invitation.`;
    return { subject, html: baseHtml(content), text };
  },

  paymentConfirmationRequest(params: {
    tripName: string;
    payerName: string;
    amountFormatted: string;
  }): EmailTemplateResult {
    const subject = `tripCircle — Action Required: Payment confirmation from ${params.payerName}`;
    const content = `
      <h2 style="margin-top:0; color:#0f172a;">Payment Received?</h2>
      <p><strong>${params.payerName}</strong> recorded a payment of <strong>${params.amountFormatted}</strong> to you for trip <strong>"${params.tripName}"</strong>.</p>
      <p>Under tripCircle's financial rules, payments only update ledger balances after you confirm receipt.</p>
      <p style="color:#64748b; font-size:14px;">Please open tripCircle to confirm or dispute this payment.</p>
    `;
    const text = `${params.payerName} recorded a payment of ${params.amountFormatted} to you in "${params.tripName}".\n\nPlease open tripCircle to confirm or dispute receipt.`;
    return { subject, html: baseHtml(content), text };
  },

  paymentDisputed(params: {
    tripName: string;
    receiverName: string;
    amountFormatted: string;
    reason: string;
  }): EmailTemplateResult {
    const subject = `tripCircle — Payment disputed by ${params.receiverName}`;
    const content = `
      <h2 style="margin-top:0; color:#e11d48;">Payment Disputed</h2>
      <p><strong>${params.receiverName}</strong> has disputed your payment of <strong>${params.amountFormatted}</strong> in trip <strong>"${params.tripName}"</strong>.</p>
      <p><strong>Reason provided:</strong> ${params.reason}</p>
      <p style="color:#64748b; font-size:14px;">The payment will not affect trip balances. You can record a corrected payment in the app.</p>
    `;
    const text = `Your payment of ${params.amountFormatted} to ${params.receiverName} in "${params.tripName}" was disputed.\nReason: ${params.reason}`;
    return { subject, html: baseHtml(content), text };
  },

  discountProposal(params: {
    tripName: string;
    fromMemberName: string;
    waivedFormatted: string;
    paidFormatted: string;
  }): EmailTemplateResult {
    const subject = `tripCircle — Settlement discount proposal from ${params.fromMemberName}`;
    const content = `
      <h2 style="margin-top:0; color:#0f172a;">Settlement Adjustment Proposal</h2>
      <p><strong>${params.fromMemberName}</strong> proposed a settlement discount for trip <strong>"${params.tripName}"</strong>.</p>
      <p>They paid <strong>${params.paidFormatted}</strong> and requested waiving <strong>${params.waivedFormatted}</strong>.</p>
      <p style="color:#64748b; font-size:14px;">Open the settlement dashboard to accept or decline this adjustment.</p>
    `;
    const text = `${params.fromMemberName} proposed a settlement adjustment in "${params.tripName}". Paid: ${params.paidFormatted}, Waived: ${params.waivedFormatted}. Open tripCircle to review.`;
    return { subject, html: baseHtml(content), text };
  },
};
