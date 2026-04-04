const PERMISSIONS = {
  admin:   ['*'],
  manager: ['read', 'create', 'update', 'delete', 'export'],
  sales:   ['read', 'create', 'update', 'export'],
  finance: ['read', 'export'],
  viewer:  ['read'],
};

function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '인증이 필요합니다' });
    const userPerms = PERMISSIONS[req.user.role] || [];
    if (userPerms.includes('*')) return next();
    const hasAll = perms.every(p => userPerms.includes(p));
    if (!hasAll) return res.status(403).json({ error: '접근 권한이 없습니다' });
    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '인증이 필요합니다' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: '접근 권한이 없습니다' });
    next();
  };
}

module.exports = { requirePermission, requireRole, PERMISSIONS };
