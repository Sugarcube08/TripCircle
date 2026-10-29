export interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
}

function baseHtml(content: string): string {
  const currentYear = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TripCircle</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #070A11;
      color: #94A3B8;
      margin: 0;
      padding: 32px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 560px;
      margin: 0 auto;
    }
    .container {
      background-color: #0F172A;
      border-radius: 16px;
      border: 1px solid #1E293B;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(180deg, #131E36 0%, #0F172A 100%);
      padding: 32px 24px 24px;
      text-align: center;
      border-bottom: 1px solid #1E293B;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-accent {
      color: #10B981;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 6px;
    }
    .content {
      padding: 32px 28px;
    }
    .heading {
      color: #FFFFFF;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 14px;
      letter-spacing: -0.3px;
    }
    .paragraph {
      color: #94A3B8;
      font-size: 14px;
      line-height: 22px;
      margin: 0 0 16px;
    }
    .strong {
      color: #F8FAFC;
      font-weight: 600;
    }
    .code-box {
      background-color: #0B0F19;
      border: 1.5px dashed #10B981;
      border-radius: 12px;
      padding: 18px;
      text-align: center;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #10B981;
      margin: 24px 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
    }
    .btn {
      display: inline-block;
      background-color: #10B981;
      color: #070A11 !important;
      padding: 14px 28px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      margin: 20px 0;
      text-align: center;
      box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.35);
    }
    .card-box {
      background-color: #131E36;
      border: 1px solid #1E293B;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .footer {
      padding: 24px;
      background-color: #0B0F19;
      border-top: 1px solid #1E293B;
      font-size: 12px;
      color: #475569;
      text-align: center;
      line-height: 18px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="brand-title">trip<span>Circle</span></h1>
        <div class="brand-sub">Exact Paise Financial Ledger</div>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">This is an automated transactional notification from TripCircle.</p>
        <p style="margin: 0;">&copy; ${currentYear} TripCircle. Zero-sum financial integrity guaranteed.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export const EmailTemplates = {
  accountVerificationOtp(otp: string): EmailTemplateResult {
    const subject = 'TripCircle — Verify Your Email Address';
    const content = `
      <h2 class="heading">Welcome to TripCircle!</h2>
      <p class="paragraph">Thank you for creating an account. Please enter the single-use 6-digit code below in your mobile app to verify your email address:</p>
      <div class="code-box">${otp}</div>
      <p class="paragraph" style="color: #64748B; font-size: 13px;">This code will expire in 10 minutes. If you did not create a TripCircle account, please disregard this message.</p>
    `;
    const text = `Welcome to TripCircle!\n\nYour 6-digit email verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not create a TripCircle account, you can safely ignore this message.`;
    return { subject, html: baseHtml(content), text };
  },

  passwordResetOtp(otp: string, resetUrl?: string): EmailTemplateResult {
    const subject = 'TripCircle — Password Recovery Code';
    const buttonHtml = resetUrl
      ? `<div style="text-align:center;"><a href="${resetUrl}" class="btn">Reset Password</a></div>`
      : '';
    const content = `
      <h2 class="heading">Password Recovery Request</h2>
      <p class="paragraph">We received a request to reset the password for your TripCircle account. Use the verification code below to proceed with resetting your credentials:</p>
      <div class="code-box">${otp}</div>
      ${buttonHtml}
      <p class="paragraph" style="color: #64748B; font-size: 13px;">This code is valid for 10 minutes. If you did not request a password recovery, your account credentials remain safe and you can safely ignore this email.</p>
    `;
    const text = `TripCircle Password Recovery\n\nYour recovery code is: ${otp}\n\n${resetUrl ? `You can also reset via this link: ${resetUrl}\n\n` : ''}This code expires in 10 minutes. If you did not request this, please secure your account.`;
    return { subject, html: baseHtml(content), text };
  },

  tripInvitation(params: {
    tripName: string;
    inviterName: string;
    appUrl?: string;
  }): EmailTemplateResult {
    const subject = `TripCircle — You've been invited to "${params.tripName}"`;
    const content = `
      <h2 class="heading">You're Invited to a Trip!</h2>
      <p class="paragraph"><span class="strong">${params.inviterName}</span> has invited you to join the shared expense ledger for <span class="strong">"${params.tripName}"</span> on TripCircle.</p>
      
      <div class="card-box">
        <div style="font-size: 13px; color: #10B981; font-weight: 700; margin-bottom: 4px;">GROUP FINANCIAL LEDGER</div>
        <div style="font-size: 15px; color: #FFFFFF; font-weight: 600;">Trip: ${params.tripName}</div>
        <div style="font-size: 13px; color: #64748B; margin-top: 4px;">Exact double-entry integer paise accounting with simplified settlements.</div>
      </div>

      ${params.appUrl ? `<div style="text-align:center;"><a href="${params.appUrl}" class="btn">Open Invitation in App</a></div>` : ''}
      <p class="paragraph" style="color: #64748B; font-size: 13px;">Log in to the TripCircle mobile app to review and accept your invitation.</p>
    `;
    const text = `${params.inviterName} has invited you to join "${params.tripName}" on TripCircle.\n\nOpen the TripCircle app to accept your invitation.`;
    return { subject, html: baseHtml(content), text };
  },

  paymentConfirmationRequest(params: {
    tripName: string;
    payerName: string;
    amountFormatted: string;
  }): EmailTemplateResult {
    const subject = `TripCircle — Action Required: Payment confirmation from ${params.payerName}`;
    const content = `
      <h2 class="heading">Action Required: Payment Received?</h2>
      <p class="paragraph"><span class="strong">${params.payerName}</span> recorded a settlement transfer of <span class="strong" style="color: #10B981;">${params.amountFormatted}</span> to you in trip <span class="strong">"${params.tripName}"</span>.</p>

      <div class="card-box" style="border-left: 4px solid #10B981;">
        <div style="font-size: 12px; color: #64748B; font-weight: 700; letter-spacing: 1px;">TRANSFER DETAILS</div>
        <div style="font-size: 18px; color: #FFFFFF; font-weight: 700; margin: 4px 0;">${params.amountFormatted}</div>
        <div style="font-size: 13px; color: #94A3B8;">Payer: ${params.payerName} &bull; Trip: ${params.tripName}</div>
      </div>

      <p class="paragraph">Under TripCircle's financial invariants, payments update group balances only after you confirm receipt. If you received this amount, confirm it in the app; otherwise, dispute it with a reason.</p>
    `;
    const text = `${params.payerName} recorded a payment of ${params.amountFormatted} to you in "${params.tripName}".\n\nPlease open TripCircle to confirm or dispute receipt.`;
    return { subject, html: baseHtml(content), text };
  },

  paymentDisputed(params: {
    tripName: string;
    receiverName: string;
    amountFormatted: string;
    reason: string;
  }): EmailTemplateResult {
    const subject = `TripCircle — Payment disputed by ${params.receiverName}`;
    const content = `
      <h2 class="heading" style="color: #F43F5E;">Payment Disputed</h2>
      <p class="paragraph"><span class="strong">${params.receiverName}</span> has disputed your recorded payment of <span class="strong">${params.amountFormatted}</span> for trip <span class="strong">"${params.tripName}"</span>.</p>

      <div class="card-box" style="border-left: 4px solid #F43F5E;">
        <div style="font-size: 12px; color: #F43F5E; font-weight: 700; letter-spacing: 1px;">REASON FOR DISPUTE</div>
        <div style="font-size: 14px; color: #FFFFFF; font-style: italic; margin-top: 6px;">"${params.reason}"</div>
      </div>

      <p class="paragraph">Because this transfer was disputed, group balances remain unaltered. You can verify the transaction details with the recipient and record a corrected payment in the app.</p>
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
    const subject = `TripCircle — Settlement discount proposal from ${params.fromMemberName}`;
    const content = `
      <h2 class="heading">Settlement Adjustment Proposal</h2>
      <p class="paragraph"><span class="strong">${params.fromMemberName}</span> proposed a settlement discount for trip <span class="strong">"${params.tripName}"</span>.</p>

      <div class="card-box">
        <div style="font-size: 13px; color: #94A3B8;">Paid Amount: <span style="color:#FFFFFF; font-weight:700;">${params.paidFormatted}</span></div>
        <div style="font-size: 13px; color: #94A3B8; margin-top: 4px;">Proposed Waiver: <span style="color:#10B981; font-weight:700;">${params.waivedFormatted}</span></div>
      </div>

      <p class="paragraph">Open the Settlement Dashboard in TripCircle to accept or reject this settlement adjustment.</p>
    `;
    const text = `${params.fromMemberName} proposed a settlement adjustment in "${params.tripName}". Paid: ${params.paidFormatted}, Waived: ${params.waivedFormatted}. Open TripCircle to review.`;
    return { subject, html: baseHtml(content), text };
  },
};
