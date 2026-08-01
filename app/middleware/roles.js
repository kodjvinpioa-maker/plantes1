// middleware/roles.js
const { requireLogin: requireLoginAuth } = require('./auth') || {};

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'admin' && req.session.user.role !== 'superadmin') {
    return res.status(403).render('acces-refuse');
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'superadmin') {
    return res.status(403).render('acces-refuse');
  }
  next();
}

module.exports = { requireLogin, requireAdmin, requireSuperAdmin };