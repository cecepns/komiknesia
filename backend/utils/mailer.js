/* global require, module, process */
const nodemailer = require('nodemailer');

/**
 * Configure Nodemailer transporter using environment variables.
 * Fallback to direct SMTP / console logger if credentials not yet configured.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true;
  const user = process.env.SMTP_USER || 'Id.komiknesia@gmail.com';
  const pass = (process.env.SMTP_PASS || 'dvsx bqln fxge gjej').replace(/\s+/g, '');

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

const transporter = createTransporter();

/**
 * Generate email HTML template for OTP / Reset Link
 */
function getEmailHtml({ name, otpCode, resetLink, purposeTitle, description, warningText }) {
  const safeName = name ? String(name).replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Pengguna Komiknesia';
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${purposeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background-color:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #dc2626 0%, #991b1b 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:1px;">
                KOMIKNESIA
              </h1>
              <p style="margin:6px 0 0 0;font-size:13px;color:#fecaca;font-weight:500;">
                Platform Baca Komik & Manga Indonesia
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;">
              <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:700;color:#ffffff;">
                Halo, ${safeName}!
              </h2>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#cbd5e1;">
                ${description}
              </p>

              ${
                resetLink
                  ? `
              <!-- Direct Reset Link Button -->
              <div style="text-align:center;margin:28px 0 20px 0;">
                <a href="${resetLink}" target="_blank" style="display:inline-block;background-color:#ef4444;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:bold;font-size:15px;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(239,68,68,0.4);">
                  Reset Password Sekarang &rarr;
                </a>
              </div>
              <p style="margin:0 0 16px 0;font-size:13px;color:#94a3b8;text-align:center;">
                Atau masukkan kode verifikasi 6 digit di bawah ini pada halaman reset password:
              </p>
              `
                  : ''
              }

              <!-- OTP Box -->
              <div style="background-color:#090d16;border:2px dashed #dc2626;border-radius:12px;padding:20px;text-align:center;margin:${resetLink ? '12px' : '24px'} 0 24px 0;">
                <span style="display:block;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:8px;">
                  Kode Verifikasi OTP Anda
                </span>
                <span style="display:inline-block;font-size:36px;font-weight:800;letter-spacing:10px;color:#ef4444;font-family:Consolas,Monaco,'Courier New',monospace;padding-left:10px;">
                  ${otpCode}
                </span>
                <span style="display:block;font-size:12px;color:#64748b;margin-top:8px;">
                  Berlaku selama <strong>10 menit</strong>
                </span>
              </div>

              <!-- Warning -->
              <div style="background-color:rgba(239,68,68,0.1);border-left:4px solid #ef4444;padding:12px 16px;border-radius:6px;margin-bottom:24px;">
                <p style="margin:0;font-size:12px;color:#fca5a5;line-height:1.5;">
                  <strong>Penting:</strong> ${warningText || 'Jangan berikan link atau kode ini kepada siapapun. Pihak Komiknesia tidak pernah meminta kode OTP Anda.'}
                </p>
              </div>

              ${
                resetLink
                  ? `
              <p style="margin:0 0 8px 0;font-size:11px;color:#64748b;word-break:break-all;line-height:1.4;">
                Jika tombol di atas tidak berfungsi, salin dan buka URL berikut di browser Anda:<br>
                <a href="${resetLink}" style="color:#ef4444;text-decoration:underline;">${resetLink}</a>
              </p>
              `
                  : ''
              }

              <p style="margin:16px 0 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">
                Jika Anda tidak merasa meminta reset password ini, silakan abaikan email ini. Akun Anda tetap aman.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#090d16;padding:20px 28px;text-align:center;border-top:1px solid #334155;">
              <p style="margin:0;font-size:12px;color:#64748b;">
                &copy; ${new Date().getFullYear()} Komiknesia. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Send OTP for Registration
 */
async function sendRegisterOtpEmail({ to, name, otpCode }) {
  const from = process.env.SMTP_FROM || '"Komiknesia" <Id.komiknesia@gmail.com>';
  const subject = `Kode Verifikasi Pendaftaran Komiknesia: ${otpCode}`;
  const html = getEmailHtml({
    name,
    otpCode,
    purposeTitle: 'Verifikasi Akun Baru Komiknesia',
    description: 'Terima kasih telah mendaftar di Komiknesia! Gunakan kode verifikasi di bawah ini untuk menyelesaikan pendaftaran akun Anda.',
    warningText: 'Kode ini hanya digunakan untuk mengonfirmasi email pendaftaran akun Anda.',
  });

  return await transporter.sendMail({
    from,
    to,
    subject,
    text: `Kode verifikasi pendaftaran Komiknesia Anda adalah: ${otpCode}. Kode berlaku selama 10 menit.`,
    html,
  });
}

/**
 * Send OTP and Direct Reset Link for Password Reset
 */
async function sendResetPasswordOtpEmail({ to, name, otpCode, resetLink }) {
  const from = process.env.SMTP_FROM || '"Komiknesia" <Id.komiknesia@gmail.com>';
  const subject = `Link & Kode Reset Password Komiknesia: ${otpCode}`;
  const html = getEmailHtml({
    name,
    otpCode,
    resetLink,
    purposeTitle: 'Permintaan Reset Password Komiknesia',
    description: 'Kami menerima permintaan untuk mereset kata sandi akun Komiknesia Anda. Klik tombol di bawah ini atau masukkan kode verifikasi untuk mengatur kata sandi baru.',
    warningText: 'Jika Anda tidak meminta reset kata sandi, segera amankan akun Anda.',
  });

  return await transporter.sendMail({
    from,
    to,
    subject,
    text: `Permintaan reset password Komiknesia.\n\nLink reset: ${resetLink || 'Silakan buka halaman akun'}\nKode OTP: ${otpCode}\n\nBerlaku selama 10 menit.`,
    html,
  });
}

module.exports = {
  transporter,
  sendRegisterOtpEmail,
  sendResetPasswordOtpEmail,
};
