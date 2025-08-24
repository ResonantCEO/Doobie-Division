import { MailService } from '@sendgrid/mail';

let mailService: MailService | null = null;

// Initialize SendGrid only if API key is available
if (process.env.SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.log('SendGrid API key not configured - emails will be logged to console in development mode');
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    // If no SendGrid configuration, log to console in development
    if (!mailService || process.env.NODE_ENV === 'development') {
      console.log('\n=== EMAIL WOULD BE SENT ===');
      console.log(`To: ${params.to}`);
      console.log(`From: ${params.from}`);
      console.log(`Subject: ${params.subject}`);
      console.log(`Content: ${params.text || params.html || 'No content'}`);
      console.log('========================\n');
      
      // If we have SendGrid configured, still send the actual email in development
      if (mailService) {
        await mailService.send({
          to: params.to,
          from: params.from,
          subject: params.subject,
          text: params.text || undefined,
          html: params.html || undefined,
        });
        console.log('Email sent via SendGrid');
      }
      return true;
    }

    // Production email sending
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || undefined,
      html: params.html || undefined,
    });
    
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export function createPasswordResetEmail(resetToken: string, userFirstName: string, resetUrl: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Password Reset - Doobie Division</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Doobie Division</h1>
            </div>
            <div class="content">
                <h2>Password Reset Request</h2>
                <p>Hi ${userFirstName},</p>
                <p>You requested to reset your password for your Doobie Division account. Click the button below to set a new password:</p>
                <p><a href="${resetUrl}" class="button">Reset Password</a></p>
                <p>Or copy and paste this link into your browser:</p>
                <p><a href="${resetUrl}">${resetUrl}</a></p>
                <p>This link will expire in 1 hour for security reasons.</p>
                <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
                <p>Thanks,<br>The Doobie Division Team</p>
            </div>
            <div class="footer">
                <p>© 2025 Doobie Division. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
Hi ${userFirstName},

You requested to reset your password for your Doobie Division account.

Please visit this link to reset your password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email and your password will remain unchanged.

Thanks,
The Doobie Division Team
  `;

  return { html, text };
}