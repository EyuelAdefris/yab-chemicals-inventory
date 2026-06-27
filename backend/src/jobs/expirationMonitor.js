const cron = require('node-cron');
const pool = require('../db/pool');

const runExpirationCheck = async () => {
  try {
    console.log('Running expiration check...');

    const expiringResult = await pool.query(`
      SELECT cb.id, cb.batch_number, cb.expiration_date,
        cc.name AS category_name,
        is_table.containers_available,
        EXTRACT(DAY FROM (cb.expiration_date - CURRENT_DATE)) AS days_remaining
      FROM chemical_batches cb
      JOIN chemical_categories cc ON cb.category_id = cc.id
      JOIN inventory_stock is_table ON cb.id = is_table.batch_id
      WHERE cb.status = 'active'
        AND cb.expiration_date <= CURRENT_DATE + INTERVAL '2 months'
      ORDER BY cb.expiration_date ASC
    `);

    const expiringBatches = expiringResult.rows;
    let flaggedCount = 0;

    for (const batch of expiringBatches) {
      const dateStr = batch.expiration_date.toISOString().split('T')[0];

      const managerMessage =
        `URGENT: Batch ${batch.batch_number} (${batch.category_name}) expires in ${batch.days_remaining} days (${dateStr}). Containers available: ${batch.containers_available}. Prioritize selling immediately.`;

      const marketerMessage =
        `URGENT: Batch ${batch.batch_number} (${batch.category_name}) expires in ${batch.days_remaining} days (${dateStr}). ${batch.containers_available} containers still available. Push sales immediately to avoid expiry loss.`;

      const duplicateCheck = await pool.query(
        `SELECT id FROM notifications
         WHERE related_batch_id = $1
           AND DATE(created_at) = CURRENT_DATE
           AND message LIKE 'URGENT%'`,
        [batch.id]
      );

      if (duplicateCheck.rows.length === 0) {
        const managerRoles = ['owner', 'finance', 'storekeeper'];
        for (const role of managerRoles) {
          await pool.query(
            `INSERT INTO notifications (recipient_role, related_batch_id, message) VALUES ($1, $2, $3)`,
            [role, batch.id, managerMessage]
          );
        }

        await pool.query(
          `INSERT INTO notifications (recipient_role, related_batch_id, message) VALUES ($1, $2, $3)`,
          ['marketer', batch.id, marketerMessage]
        );

        flaggedCount++;
      }
    }

    console.log(`Expiration check complete. ${flaggedCount} batch(es) flagged.`);
  } catch (error) {
    console.error('Error during expiration check:', error);
  }
};

const runAutoExpire = async () => {
  try {
    console.log('Checking for overdue batches...');

    const expiredResult = await pool.query(`
      UPDATE chemical_batches
      SET status = 'expired'
      WHERE status = 'active'
        AND expiration_date < CURRENT_DATE
      RETURNING batch_number, expiration_date, id
    `);

    const expiredBatches = expiredResult.rows;

    for (const batch of expiredBatches) {
      const message =
        `EXPIRED: Batch ${batch.batch_number} has passed its expiration date and has been automatically marked as expired. This batch is no longer available for sale.`;

      const roles = ['owner', 'finance', 'marketer'];
      for (const role of roles) {
        await pool.query(
          `INSERT INTO notifications (recipient_role, related_batch_id, message) VALUES ($1, $2, $3)`,
          [role, batch.id, message]
        );
      }
    }

    console.log(`Auto-expire complete. ${expiredBatches.length} batch(es) marked as expired.`);
  } catch (error) {
    console.error('Error during auto-expire check:', error);
  }
};

const startExpirationMonitor = () => {
  cron.schedule('0 6 * * *', runExpirationCheck);
  cron.schedule('0 6 * * *', runAutoExpire);
  console.log('Expiration monitor scheduled (daily at 6:00 AM).');
};

const runExpirationCheckNow = async () => {
  await runExpirationCheck();
  await runAutoExpire();
};

module.exports = { startExpirationMonitor, runExpirationCheckNow };
