// lib/activity.js
// Journal d'activité : trace qui a fait quoi et quand.

const db = require('../db');

/**
 * Enregistre une action dans le journal d'activité.
 * @param {object} req      requête Express (pour récupérer l'utilisateur en session)
 * @param {string} action   ex: 'vente', 'produit_creation', 'caisse_sortie'
 * @param {string} cible    ex: 'Produit #12'
 * @param {string} details  texte libre
 */
function log(req, action, cible, details) {
  const user = (req && req.session && req.session.user) || null;
  db.run(
    'INSERT INTO journal_activite (user_id, user_email, action, cible, details) VALUES (?, ?, ?, ?, ?)',
    [user ? user.id : null, user ? user.email : 'système', action, cible || null, details || null],
    (err) => {
      if (err) console.error('Journal activité :', err.message);
    }
  );
}

// Version système (sans requête HTTP), utilisée par la clôture automatique.
function logSysteme(action, cible, details) {
  db.run(
    'INSERT INTO journal_activite (user_id, user_email, action, cible, details) VALUES (NULL, ?, ?, ?, ?)',
    ['système', action, cible || null, details || null],
    (err) => {
      if (err) console.error('Journal activité :', err.message);
    }
  );
}

module.exports = { log, logSysteme };
