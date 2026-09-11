import cron from 'node-cron';
import { scanExpiringDocuments } from './notificationService';

export const startScheduler = () => {
  console.log('Compliance scheduler initialized');

  cron.schedule('0 0 9 * * *', async () => {
    console.log('Running compliance scan...');
    await checkExpiringDocuments();
  });
};

export const checkExpiringDocuments = async () => {
  try {
    const created = await scanExpiringDocuments();
    if (created > 0) {
      console.log(`Generated ${created} expiry alert(s)`);
    }
  } catch (error) {
    console.error('Scheduler error:', error);
  }
};
