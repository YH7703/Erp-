const db = require('../db');

async function logAudit({ userId, username, action, entityType, entityId, oldValues, newValues, ip }) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId || null, username || null, action, entityType, entityId || null,
       oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, ip || null]
    );
  } catch (err) {
    console.error('Audit log 저장 실패:', err.message);
  }
}

function auditMiddleware(req, res, next) {
  req.audit = (action, entityType, entityId, oldValues, newValues) => {
    return logAudit({
      userId: req.user?.id, username: req.user?.username,
      action, entityType, entityId, oldValues, newValues, ip: req.ip
    });
  };
  next();
}

module.exports = { auditMiddleware, logAudit };
