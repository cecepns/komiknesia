/**
 * Normalize role from MySQL row or JWT claim for consistent admin checks and /me.
 */
function parseUserRole(raw) {
  if (raw == null) return null;
  if (Buffer.isBuffer(raw)) {
    const s = raw.toString('utf8').trim();
    return s ? s.toLowerCase() : null;
  }
  const s = String(raw).trim();
  return s ? s.toLowerCase() : null;
}

/** Prefer DB; if missing/empty, fall back to JWT (older deploys / odd drivers). */
function resolveUserRole(rowRole, jwtRole) {
  const fromDb = parseUserRole(rowRole);
  if (fromDb != null) return fromDb;
  const fromJwt = parseUserRole(jwtRole);
  if (fromJwt != null) return fromJwt;
  return 'user';
}

module.exports = { parseUserRole, resolveUserRole };
