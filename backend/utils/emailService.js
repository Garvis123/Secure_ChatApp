import nodemailer from 'nodemailer';

// Configure email transporter
const createTransporter = () => {
  // For Gmail (Free)
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Your Gmail address
      pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD // App Password (not regular password)
    }
  });

  // Alternative: For other email services
  /*
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  */
};

// Send OTP email
const sendOTPEmail = async (email, otp, username = 'User') => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Secure Chat Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Your Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 40px 30px;
              text-align: center;
            }
            .otp-box {
              background: #f8f9fa;
              border: 2px dashed #667eea;
              border-radius: 8px;
              padding: 20px;
              margin: 30px 0;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #667eea;
            }
            .info {
              color: #666;
              font-size: 14px;
              line-height: 1.6;
              margin-top: 20px;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #999;
              font-size: 12px;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Secure Chat Platform</h1>
            </div>
            <div class="content">
              <h2>Hello ${username}!</h2>
              <p>Your verification code is:</p>
              <div class="otp-box">
                ${otp}
              </div>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This code will expire in <strong>10 minutes</strong></li>
                  <li>Never share this code with anyone</li>
                  <li>Our team will never ask for this code</li>
                </ul>
              </div>
              <div class="info">
                If you didn't request this code, please ignore this email or contact support if you're concerned about your account security.
              </div>
            </div>
            <div class="footer">
              <p>© 2025 Secure Chat Platform. All rights reserved.</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, username) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Secure Chat Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Welcome to Secure Chat Platform!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .content {
              padding: 40px 30px;
            }
            .feature {
              padding: 15px;
              margin: 10px 0;
              background: #f8f9fa;
              border-left: 4px solid #667eea;
            }
            .button {
              display: inline-block;
              padding: 15px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome ${username}!</h1>
              <p>Your account has been created successfully</p>
            </div>
            <div class="content">
              <h2>Get Started with Secure Communication</h2>
              <p>You now have access to:</p>
              
              <div class="feature">
                <strong>🔐 End-to-End Encryption</strong><br>
                Your messages are encrypted on your device
              </div>
              
              <div class="feature">
                <strong>🖼️ Steganography</strong><br>
                Hide secret messages inside images
              </div>
              
              <div class="feature">
                <strong>⏰ Self-Destructing Messages</strong><br>
                Messages that disappear after reading
              </div>
              
              <div class="feature">
                <strong>🔒 Multi-Factor Authentication</strong><br>
                Extra layer of security for your account
              </div>
              
              <center>
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" class="button">
                  Start Chatting Now
                </a>
              </center>
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Need help? Contact us at support@securechat.com
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('❌ Welcome email failed:', error);
    // Don't throw error for welcome email
    return { success: false };
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, username) => {
  try {
    const transporter = createTransporter();
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    const mailOptions = {
      from: `"Secure Chat Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔑 Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 10px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 40px 30px; }
            .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔑 Password Reset</h1>
            </div>
            <div class="content">
              <h2>Hi ${username},</h2>
              <p>You requested to reset your password. Click the button below:</p>
              <center>
                <a href="${resetUrl}" class="button">Reset Password</a>
              </center>
              <p style="margin-top: 20px; color: #666; font-size: 14px;">
                This link will expire in 1 hour.<br>
                If you didn't request this, please ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('❌ Password reset email failed:', error);
    throw new Error('Failed to send password reset email');
  }
};

export default {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail
};