import { buildMailtoUrl, sendEmail } from '../services/emailService';

describe('emailService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('logs the reminder when SMTP is not configured', async () => {
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const result = await sendEmail({
        to: 'boss@example.com',
        subject: 'Amara expires',
        text: 'Renew the ticket',
      });
      expect(result.channel).toBe('log');
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('builds a mailto URL for the next action', () => {
    const url = buildMailtoUrl({
      to: 'amara@example.com',
      subject: 'Ticket',
      text: 'Please renew',
    });
    expect(url.startsWith('mailto:amara%40example.com?')).toBe(true);
    expect(url).toContain('subject=Ticket');
  });
});
