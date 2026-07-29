// routes/dashboard.js
// Tableau de bord : indicateurs clés dès la connexion.

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');
const { getSoldeCaisse } = require('./caisse');
const { STOCK_EXPR } = require('../lib/stock-sql');

const STOCK_SQL = `${STOCK_EXPR} AS stock_actuel`;

router.get('/dashboard', requireLogin, (req, res) => {
  db.get('SELECT COUNT(*) AS total FROM produits WHERE actif = 1', [], (err, totalRow) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur serveur');
    }

    db.all(
      `SELECT p.*, ${STOCK_SQL} FROM produits p WHERE p.actif = 1 ORDER BY p.nom ASC`,
      [],
      (prodErr, produits) => {
        if (prodErr) {
          console.error(prodErr);
          return res.status(500).send('Erreur serveur');
        }

        const produitsEnAlerte = produits.filter((p) => p.stock_actuel <= p.seuil_alerte);
        const top5Alertes = [...produitsEnAlerte]
          .sort((a, b) => (a.stock_actuel - a.seuil_alerte) - (b.stock_actuel - b.seuil_alerte))
          .slice(0, 5);
        const uniteEnStock = produits.reduce((acc, p) => acc + (p.stock_actuel || 0), 0);

        getSoldeCaisse((caisseErr, solde) => {
          if (caisseErr) {
            console.error(caisseErr);
            return res.status(500).send('Erreur serveur');
          }

          db.get(
            `SELECT COUNT(*) AS nb_ventes,
                    COALESCE(SUM(quantite * COALESCE(prix_vente_effectif, 0)), 0) AS ca
             FROM mouvements_stock
             WHERE type = 'vente' AND date(date_mouvement) = date('now','localtime')`,
            [],
            (jourErr, jour) => {
              if (jourErr) {
                console.error(jourErr);
                return res.status(500).send('Erreur serveur');
              }

              db.all(
                `SELECT ms.*, p.nom AS produit_nom, p.photo_url, u.email AS user_email
                 FROM mouvements_stock ms
                 LEFT JOIN produits p ON p.id = ms.produit_id
                 LEFT JOIN users u ON u.id = ms.user_id
                 ORDER BY ms.date_mouvement DESC LIMIT 8`,
                [],
                (mvtErr, derniersMouvements) => {
                  if (mvtErr) {
                    console.error(mvtErr);
                    return res.status(500).send('Erreur serveur');
                  }

                  res.render('dashboard', {
                    title: 'Tableau de bord',
                    totalProduits: totalRow.total,
                    uniteEnStock,
                    totalAlertes: produitsEnAlerte.length,
                    soldeCaisse: solde,
                    ventesDuJour: jour.nb_ventes,
                    caDuJour: jour.ca,
                    derniersMouvements,
                    top5Alertes,
                  });
                }
              );
            }
          );
        });
      }
    );
  });
});

module.exports = router;
