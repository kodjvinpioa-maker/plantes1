// routes/produits.js
// CRUD produits (photo, prix d'achat, prix de vente, seuil d'alerte).
// Création / modification / archivage réservés à l'administrateur.
// Le stock n'est jamais stocké : il est calculé depuis les mouvements.

const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { log } = require('../lib/activity');
const { STOCK_EXPR } = require('../lib/stock-sql');

const STOCK_SQL = `${STOCK_EXPR} AS stock_actuel`;

// Détermine la photo à enregistrer : fichier téléversé > URL saisie > existante
function resolvePhoto(req, existante) {
  if (req.file) return `/uploads/${req.file.filename}`;
  const url = (req.body.photo_url || '').trim();
  if (url) return url;
  return existante || null;
}

// --- Liste ------------------------------------------------------------------
router.get('/produits', requireLogin, (req, res) => {
  const q = (req.query.q || '').trim();
  let sql = `SELECT p.*, ${STOCK_SQL} FROM produits p`;
  const params = [];

  if (q) {
    sql += ' WHERE p.nom LIKE ? OR p.reference LIKE ?';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY p.actif DESC, p.nom ASC';

  db.all(sql, params, (err, produits) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur serveur');
    }
    res.render('produits/liste', {
      title: 'Produits',
      produits,
      q,
      csrfToken: req.csrfToken(),
    });
  });
});

// --- Création ---------------------------------------------------------------
router.get('/produits/nouveau', requireAdmin, (req, res) => {
  res.render('produits/form', { title: 'Nouveau produit', produit: null, error: null, csrfToken: req.csrfToken() });
});

router.post('/produits/nouveau', requireAdmin, (req, res) => {
  const { reference, nom, seuil_alerte, prix_vente, prix_achat } = req.body;

  if (!reference || !nom) {
    return res.render('produits/form', {
      title: 'Nouveau produit',
      produit: req.body,
      error: 'La référence et le nom sont obligatoires.',
      csrfToken: req.csrfToken(),
    });
  }

  const photo = resolvePhoto(req, null);

  db.run(
    `INSERT INTO produits (reference, nom, seuil_alerte, prix_vente, prix_achat, photo_url, actif)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [
      reference.trim(),
      nom.trim(),
      parseInt(seuil_alerte, 10) || 0,
      parseFloat(prix_vente) || null,
      parseFloat(prix_achat) || null,
      photo,
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.render('produits/form', {
          title: 'Nouveau produit',
          produit: req.body,
          error: err.message.includes('UNIQUE') ? 'Cette référence existe déjà.' : 'Erreur lors de la création du produit.',
          csrfToken: req.csrfToken(),
        });
      }
      log(req, 'produit_creation', `Produit #${this.lastID}`, `${reference} — ${nom}`);
      res.redirect('/produits?success=creation');
    }
  );
});

// --- Modification -----------------------------------------------------------
router.get('/produits/:id/modifier', requireAdmin, (req, res) => {
  db.get('SELECT * FROM produits WHERE id = ?', [req.params.id], (err, produit) => {
    if (err || !produit) return res.status(404).send('Produit introuvable');
    res.render('produits/form', { title: 'Modifier le produit', produit, error: null, csrfToken: req.csrfToken() });
  });
});

router.post('/produits/:id/modifier', requireAdmin, (req, res) => {
  const { reference, nom, seuil_alerte, prix_vente, prix_achat } = req.body;
  const { id } = req.params;

  if (!reference || !nom) {
    return res.render('produits/form', {
      title: 'Modifier le produit',
      produit: { ...req.body, id },
      error: 'La référence et le nom sont obligatoires.',
      csrfToken: req.csrfToken(),
    });
  }

  db.get('SELECT photo_url FROM produits WHERE id = ?', [id], (getErr, existant) => {
    const photo = resolvePhoto(req, existant ? existant.photo_url : null);

    db.run(
      `UPDATE produits SET reference = ?, nom = ?, seuil_alerte = ?, prix_vente = ?, prix_achat = ?, photo_url = ?
       WHERE id = ?`,
      [
        reference.trim(),
        nom.trim(),
        parseInt(seuil_alerte, 10) || 0,
        parseFloat(prix_vente) || null,
        parseFloat(prix_achat) || null,
        photo,
        id,
      ],
      (err) => {
        if (err) {
          console.error(err);
          return res.render('produits/form', {
            title: 'Modifier le produit',
            produit: { ...req.body, id },
            error: err.message.includes('UNIQUE') ? 'Cette référence existe déjà.' : 'Erreur lors de la modification.',
            csrfToken: req.csrfToken(),
          });
        }
        log(req, 'produit_modification', `Produit #${id}`, `${reference} — ${nom}`);
        res.redirect('/produits?success=modification');
      }
    );
  });
});

// --- Archivage / réactivation ----------------------------------------------
router.post('/produits/:id/toggle', requireAdmin, (req, res) => {
  db.get('SELECT actif, nom FROM produits WHERE id = ?', [req.params.id], (err, produit) => {
    if (err || !produit) return res.status(404).send('Produit introuvable');
    const nouvelEtat = produit.actif ? 0 : 1;
    db.run('UPDATE produits SET actif = ? WHERE id = ?', [nouvelEtat, req.params.id], (updErr) => {
      if (updErr) {
        console.error(updErr);
        return res.status(500).send('Erreur serveur');
      }
      log(req, nouvelEtat ? 'produit_reactivation' : 'produit_archivage', `Produit #${req.params.id}`, produit.nom);
      res.redirect('/produits?success=statut');
    });
  });
});

// --- API autocomplétion -----------------------------------------------------
router.get('/api/produits', requireLogin, (req, res) => {
  const q = (req.query.q || '').trim();
  let sql = `SELECT p.id, p.reference, p.nom, p.prix_vente, p.photo_url, ${STOCK_SQL} FROM produits p WHERE p.actif = 1`;
  const params = [];

  if (q) {
    sql += ' AND (p.nom LIKE ? OR p.reference LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY p.nom ASC LIMIT 20';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json([]);
    }
    res.json(rows);
  });
});

module.exports = router;
