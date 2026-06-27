const pool = require('../db/pool');

const sanitizePayload = (body) => {
  if (!body || typeof body !== 'object') return null;

  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.password_hash;
  delete sanitized.current_password;
  delete sanitized.new_password;
  delete sanitized.unit_buy_price;

  return JSON.stringify(sanitized);
};

const auditLog = (actionType, entityTable) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      originalJson(body);

      if (body && body.success === true) {
        const userId = req.user?.userId || body.data?.user?.id || null;
        const role = req.user?.role || body.data?.user?.role || null;
        const entityId = body.data?.id || null;
        const payload = sanitizePayload(req.body);
        const ipAddress =
          req.headers['x-forwarded-for'] || req.ip || null;

        pool.query(
          `INSERT INTO audit_logs 
           (user_id, role_at_time, action_type, entity_table, entity_id, payload, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, role, actionType, entityTable, entityId, payload, ipAddress]
        ).catch((err) => {
          console.error('Audit log insert failed:', err);
        });
      }
    };

    next();
  };
};

module.exports = { auditLog };
