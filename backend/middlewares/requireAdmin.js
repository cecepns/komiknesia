const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || 'user').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ status: false, error: 'Akses ditolak: hanya admin' });
  }
  next();
};

module.exports = requireAdmin;
