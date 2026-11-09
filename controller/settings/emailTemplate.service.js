// services/emailTemplate.service.js

// Generate 5-digit OTP
const generateOTP = () => {
  return String(Math.floor(10000 + Math.random() * 90000));
};

// OTP Email Template
const createOTPEmailTemplate = (otp, appName = "FIT INFOTECH") => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Verification - ${appName}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f9f9f9;
            }
            .container {
                background-color: #ffffff;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                border: 1px solid #e8e8e8;
            }
            .header {
                text-align: center;
                border-bottom: 2px solid #f97316;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 {
                color: #f97316;
                font-size: 24px;
                margin: 0;
                font-weight: 700;
            }
            .header p {
                color: #6b7280;
                margin: 5px 0 0 0;
                font-size: 14px;
            }
            .otp-container {
                background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
                border-radius: 12px;
                padding: 30px;
                text-align: center;
                margin: 30px 0;
                border: 2px dashed #f97316;
            }
            .otp-code {
                font-size: 48px;
                font-weight: 700;
                color: #ea580c;
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
                background: white;
                padding: 15px 30px;
                border-radius: 8px;
                display: inline-block;
                box-shadow: 0 2px 8px rgba(249, 115, 22, 0.2);
            }
            .otp-label {
                font-size: 16px;
                color: #6b7280;
                margin-top: 10px;
            }
            .warning {
                background-color: #fef2f2;
                border-left: 4px solid #ef4444;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .warning p {
                margin: 0;
                color: #dc2626;
                font-size: 14px;
            }
            .footer {
                margin-top: 30px;
                text-align: center;
                border-top: 1px solid #e5e7eb;
                padding-top: 20px;
                color: #6b7280;
                font-size: 13px;
            }
            .footer .brand {
                color: #f97316;
                font-weight: 600;
            }
            .button {
                display: inline-block;
                background: #f97316;
                color: white;
                padding: 12px 30px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
                margin-top: 10px;
            }
            .button:hover {
                background: #ea580c;
            }
            .expiry-info {
                color: #6b7280;
                font-size: 13px;
                margin-top: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 ${appName}</h1>
                <p>Registration Verification</p>
            </div>

            <p style="font-size: 16px; color: #374151;">
                Hello,
            </p>
            <p style="font-size: 16px; color: #374151;">
                Thank you for choosing <strong>${appName}</strong>. Please use the verification code below to complete your registration.
            </p>

            <div class="otp-container">
                <div style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
                    Your Verification Code
                </div>
                <div class="otp-code">${otp}</div>
                <div class="otp-label">
                    This code will expire in <strong>5 minutes</strong>
                </div>
            </div>

            <div class="warning">
                <p>⚠️ <strong>Important:</strong> Never share this OTP with anyone. Our team will never ask for this code.</p>
            </div>

            <div class="footer">
                <p>
                    This is an automated message from <span class="brand">${appName}</span>.
                    Please do not reply to this email.
                </p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 5px;">
                    If you didn't request this verification, please ignore this email.
                </p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 5px;">
                    &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    ${appName} - Registration Verification
    
    Hello,
    
    Thank you for choosing ${appName}. Please use the verification code below to complete your registration.
    
    Your Verification Code: ${otp}
    
    This code will expire in 5 minutes.
    
    ⚠️ Important: Never share this OTP with anyone. Our team will never ask for this code.
    
    Expires in: 5 minutes
    
    This is an automated message from ${appName}. Please do not reply to this email.
    If you didn't request this verification, please ignore this email.
    
    © ${new Date().getFullYear()} ${appName}. All rights reserved.
  `;

  return {
    subject: `${appName} - Registration OTP Verification`,
    text,
    html,
  };
};

//! Password Reset Email Template
const createPasswordResetEmailTemplate = (otp, appName = "FIT INFOTECH") => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - ${appName}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f9f9f9;
            }
            .container {
                background-color: #ffffff;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                border: 1px solid #e8e8e8;
            }
            .header {
                text-align: center;
                border-bottom: 2px solid #3b82f6;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 {
                color: #3b82f6;
                font-size: 24px;
                margin: 0;
                font-weight: 700;
            }
            .header p {
                color: #6b7280;
                margin: 5px 0 0 0;
                font-size: 14px;
            }
            .otp-container {
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                border-radius: 12px;
                padding: 30px;
                text-align: center;
                margin: 30px 0;
                border: 2px dashed #3b82f6;
            }
            .otp-code {
                font-size: 48px;
                font-weight: 700;
                color: #2563eb;
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
                background: white;
                padding: 15px 30px;
                border-radius: 8px;
                display: inline-block;
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
            }
            .otp-label {
                font-size: 16px;
                color: #6b7280;
                margin-top: 10px;
            }
            .warning {
                background-color: #fef2f2;
                border-left: 4px solid #ef4444;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .warning p {
                margin: 0;
                color: #dc2626;
                font-size: 14px;
            }
            .footer {
                margin-top: 30px;
                text-align: center;
                border-top: 1px solid #e5e7eb;
                padding-top: 20px;
                color: #6b7280;
                font-size: 13px;
            }
            .footer .brand {
                color: #3b82f6;
                font-weight: 600;
            }
            .expiry-info {
                color: #6b7280;
                font-size: 13px;
                margin-top: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 ${appName}</h1>
                <p>Password Reset Verification</p>
            </div>

            <p style="font-size: 16px; color: #374151;">
                Hello,
            </p>
            <p style="font-size: 16px; color: #374151;">
                We received a request to reset your password for your <strong>${appName}</strong> account. 
                Please use the verification code below to reset your password.
            </p>

            <div class="otp-container">
                <div style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
                    Your Verification Code
                </div>
                <div class="otp-code">${otp}</div>
                <div class="otp-label">
                    This code will expire in <strong>5 minutes</strong>
                </div>
            </div>

            <div class="warning">
                <p>⚠️ <strong>Important:</strong> Never share this OTP with anyone. Our team will never ask for this code.</p>
            </div>

            <p style="font-size: 14px; color: #6b7280;">
                If you didn't request this password reset, please ignore this email or 
                <a href="mailto:support@fitinfotech.com" style="color: #3b82f6; text-decoration: underline;">contact our support team</a>.
            </p>

            <div class="footer">
                <p>
                    This is an automated message from <span class="brand">${appName}</span>.
                    Please do not reply to this email.
                </p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 5px;">
                    &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    ${appName} - Password Reset Verification
    
    Hello,
    
    We received a request to reset your password for your ${appName} account.
    Please use the verification code below to reset your password.
    
    Your Verification Code: ${otp}
    
    This code will expire in 5 minutes.
    
    ⚠️ Important: Never share this OTP with anyone. Our team will never ask for this code.
    
    If you didn't request this password reset, please ignore this email.
    
    This is an automated message from ${appName}. Please do not reply to this email.
    
    © ${new Date().getFullYear()} ${appName}. All rights reserved.
  `;

  return {
    subject: `${appName} - Password Reset OTP Verification`,
    text,
    html,
  };
};

// Update the exports
module.exports = {
  generateOTP,
  createOTPEmailTemplate,
  createPasswordResetEmailTemplate,
};
