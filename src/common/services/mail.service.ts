import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get("MAIL_HOST"),
      port: this.configService.get("MAIL_PORT"),
      secure: this.configService.get("MAIL_SECURE") === "true",
      auth: {
        user: this.configService.get("MAIL_USER"),
        pass: this.configService.get("MAIL_PASSWORD"),
      },
    });
  }

  async sendOtpEmail(to: string, otp: string, firstName?: string) {
    const mailOptions = {
      from: this.configService.get("MAIL_FROM"),
      to,
      subject: "Verify Your Email - FX Trading",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 8px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
            </div>
            <div class="content">
              <p>Hi ${firstName || "there"},</p>
              <p>Thank you for registering with FX Trading! Please use the OTP below to verify your email address:</p>
              <div class="otp-box">${otp}</div>
              <p><strong>This OTP will expire in 10 minutes.</strong></p>
              <p>If you didn't request this verification, please ignore this email.</p>
              <p>Best regards,<br>FX Trading Team</p>
            </div>
            <div class="footer">
              <p>© 2024 FX Trading. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`OTP email sent to ${to}`);
    } catch (error) {
      console.error("Error sending OTP email:", error);
      throw new Error("Failed to send OTP email");
    }
  }

  async sendWelcomeEmail(to: string, firstName: string) {
    const mailOptions = {
      from: this.configService.get("MAIL_FROM"),
      to,
      subject: "Welcome to FX Trading!",
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Welcome to FX Trading, ${firstName}!</h2>
            <p>Your email has been verified successfully. You can now start trading currencies.</p>
            <p>Get started by:</p>
            <ul>
              <li>Funding your wallet</li>
              <li>Checking current FX rates</li>
              <li>Making your first trade</li>
            </ul>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Happy trading!</p>
          </div>
        </body>
        </html>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
