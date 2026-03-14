const nodemailer = require('nodemailer');

let transporterPromise;

async function createTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  const testAccount = await nodemailer.createTestAccount();

  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = createTransporter();
  }

  return transporterPromise;
}

async function sendMagicLinkEmail({ email, magicLink }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || 'Rentz Arena <no-reply@rentzarena.local>',
    to: email,
    subject: 'Your Rentz Arena sign-in link',
    text: `Use this link to sign in to Rentz Arena: ${magicLink}`,
    html: `<p>Use this link to sign in to Rentz Arena:</p><p><a href="${magicLink}">${magicLink}</a></p>`
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info) || null
  };
}

module.exports = {
  sendMagicLinkEmail
};
