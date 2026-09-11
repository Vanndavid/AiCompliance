type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type EmailChannel = 'smtp' | 'log';

export type EmailSendResult = {
  channel: EmailChannel;
  to: string;
};

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);

const sendViaSmtp = async ({ to, subject, text }: SendEmailInput) => {
  const nodemailer = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
  });
};

export const sendEmail = async (input: SendEmailInput): Promise<EmailSendResult> => {
  if (!input.to.trim()) {
    throw new Error('Email recipient is required');
  }

  if (smtpConfigured()) {
    await sendViaSmtp(input);
    return { channel: 'smtp', to: input.to };
  }

  console.log(`[reminder:log] to=${input.to} subject=${input.subject}\n${input.text}`);
  return { channel: 'log', to: input.to };
};

export const buildMailtoUrl = ({ to, subject, text }: SendEmailInput) => {
  const params = new URLSearchParams({ subject, body: text });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
};
