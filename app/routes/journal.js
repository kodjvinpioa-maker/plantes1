// routes/journal.js
// Journal d'activité (traçabilité) : qui a fait quoi et quand.
// Réservé à l'administrateur.

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

function buildQuery(query) {
  let sql = `
    SELECT j.*, u.email AS email_utilisateur
    FROM journal_activite j
    LEFT JOIN users u ON u.id = j.user_id
    WHERE 1=1
  `;
  const params = [];

  if (query.user_id) {
    sql += ' AND j.user_id = ?';
    params.push(query.user_id);
  }
  if (query.action) {
    sql += ' AND j.action = ?';
    params.push(query.action);
  }
  if (query.date_debut) {
    sql += ' AND date(j.date_action) >= date(?)';
    params.push(query.date_debut);
  }
  if (query.date_fin) {
    sql += ' AND date(j.date_action) <= date(?)';
    params.push(query.date_fin);
  }
  sql += ' ORDER BY j.date_action DESC LIMIT 500';
  return { sql, params };
}

router.get('/journal', requireAdmin, (req, res) => {
  const { sql, params } = buildQuery(req.query);

  db.all(sql, params, (err, entrees) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur serveur');
    }
    db.all('SELECT id, email FROM users ORDER BY email ASC', [], (uErr, users) => {
      db.all('SELECT DISTINCT action FROM journal_activite ORDER BY action ASC', [], (aErr, actions) => {
        res.render('journal/index', {
          title: "Journal d'activité",
          entrees,
          users: users || [],
          actions: (actions || []).map((a) => a.action),
          filters: req.query,
        });
      });
    });
  });
});

router.get('/journal/export.csv', requireAdmin, (req, res) => {
  const { sql, params } = buildQuery(req.query);

  db.all(sql, params, (err, entrees) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur serveur');
    }
    const clean = (v) => String(v == null ? '' : v).replace(/;/g, ',');
    let csv = 'Date;Utilisateur;Action;Cible;Details\n';
    entrees.forEach((e) => {
      csv += [e.date_action, clean(e.user_email), clean(e.action), clean(e.cible), clean(e.details)].join(';') + '\n';
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=journal_activite.csv');
    res.send('\uFEFF' + csv);
  });
});

module.exports = router;
