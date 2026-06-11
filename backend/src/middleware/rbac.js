const { fail } = require('../utils/respond');

// Usage: router.post('/', authenticate, requireRole('admin', 'mof_supervisor'), handler)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!roles.includes(req.user.role)) {
      return fail(res, 403, 'FORBIDDEN', 'Insufficient permissions for this action');
    }
    next();
  };
}

// Applies role-based visibility to a gerpi_organizations query (alias `g`).
// admin / mof_supervisor see everything; others are scoped to their unit.
function scopeGerpiQuery(query, user) {
  switch (user.role) {
    case 'ministry_officer':
      return query.where('g.ministry_id', user.ministry_id);
    case 'gerpi_staff':
      return query.where('g.id', user.gerpi_id);
    case 'donor_viewer':
      return query.where('g.donor_id', user.donor_id);
    default:
      return query;
  }
}

// True if the user is allowed to see this specific organization row.
function canSeeGerpi(user, org) {
  switch (user.role) {
    case 'ministry_officer': return org.ministry_id === user.ministry_id;
    case 'gerpi_staff': return org.id === user.gerpi_id;
    case 'donor_viewer': return org.donor_id === user.donor_id;
    default: return true;
  }
}

module.exports = { requireRole, scopeGerpiQuery, canSeeGerpi };
