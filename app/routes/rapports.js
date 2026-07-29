// routes/rapports.js
// Rapports réservés à l'administrateur : chiffre d'affaires, bénéfice brut,
// graphique d'évolution et export CSV.

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Détermine la période à partir des paramètres d'URL
function resolvePeriode(query) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const periode = query.periode || 'mois';

  if (periode === 'personnalise' && query.date_debut && query.date_fin) {
    return { periode, debut: query.date_debut, fin: query.date_fin };
  }

  const fin = iso(today);
  const debutDate = new Date(today);

  if (periode === 'jour') debutDate.setDate(today.getDate());
  else if (periode === 'semaine') debutDate.setDate(today.getDate() - 6);
  else debutDate.setDate(today.getDate() - 29);

  return { periode, debut: iso(debutDate), fin };
}

// Récupère les ventes de la période, avec le coût d'achat du produit
function chargerVentes(debut, fin, cb) {
  db.all(
    `SELECT ms.*, p.nom AS produit_nom, p.reference AS produit_reference,
            COALESCE(ms.prix_achat_effectif, p.prix_achat, 0) AS cout_unitaire,
            u.email AS user_email
     FROM mouvements_stock ms
     LEFT JOIN produits p ON p.id = ms.produit_id
     LEFT JOIN users u ON u.id = ms.user_id
     WHERE ms.type = 'vente'
       AND date(ms.date_mouvement) >= date(?)
       AND date(ms.date_mouvement) <= date(?)
     ORDER BY ms.date_mouvement ASC`,
    [debut, fin],
    cb
  );
}

function calculerStats(ventes) {
  let chiffreAffaires = 0;
  let coutAchat = 0;
  const parJour = new Map();

  ventes.forEach((v) => {
    const ca = (v.prix_vente_effectif || 0) * v.quantite;
    const cout = (v.cout_unitaire || 0) * v.quantite;
    chiffreAffaires += ca;
    coutAchat += cout;

    const jour = String(v.date_mouvement).slice(0, 10);
    parJour.set(jour, (parJour.get(jour) || 0) + ca);
  });

  const labels = [...parJour.keys()].sort();
  return {
    nbVentes: ventes.length,
    chiffreAffaires,
    coutAchat,
    beneficeBrut: chiffreAffaires - coutAchat,
    panierMoyen: ventes.length ? chiffreAffaires / ventes.length : 0,
    graph: { labels, valeurs: labels.map((l) => parJour.get(l)) },
  };
}

router.get('/rapports', requireAdmin, (req, res) => {
  const { periode, debut, fin } = resolvePeriode(req.query);

  chargerVentes(debut, fin, (err, ventes) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur serveur');
    }

    const stats = calculerStats(ventes);

    db.all(
      `SELECT p.nom, p.reference,
              SUM(ms.quantite) AS quantite_vendue,
              SUM(ms.quantite * COALESCE(ms.prix_vente_effectif, 0)) AS ca
       FROM mouvements_stock ms
       LEFT JOIN produits p ON p.id = ms.produit_id
       WHERE ms.type = 'vente'
         AND date(ms.date_mouvement) >= date(?)
         AND date(ms.date_mouvement) <= date(?)
       GROUP BY ms.produit_id
       ORDER BY ca DESC
       LIMIT 10`,
      [debut, fin],
      (topErr, topProduits) => {
        res.render('rapports/index', {
          title: 'Rapports',
          stats,
          topProduits: topProduits || [],
          filters: { periode, date_debut: debut, date_fin: fin },
        });
      }
    );
  });
});

router.get('/rapports/export.csv', requireAdmin, (req, res) => {
  const { debut, fin } = resolvePeriode(req.query);

  chargerVentes(debut, fin, (err, ventes) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur serveur');
    }
    const clean = (v) => String(v == null ? '' : v).replace(/;/g, ',');
    let csv = 'Date;Produit;Reference;Quantite;Prix de vente;Montant;Cout achat unitaire;Benefice brut;Vendeur\n';
    ventes.forEach((v) => {
      const montant = (v.prix_vente_effectif || 0) * v.quantite;
      const cout = (v.cout_unitaire || 0) * v.quantite;
      csv += [
        v.date_mouvement,
        clean(v.produit_nom),
        clean(v.produit_reference),
        v.quantite,
        v.prix_vente_effectif || 0,
        montant.toFixed(2),
        v.cout_unitaire || 0,
        (montant - cout).toFixed(2),
        clean(v.user_email),
      ].join(';') + '\n';
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=rapport_ventes_${debut}_${fin}.csv`);
    res.send('\uFEFF' + csv);
  });
});

module.exports = router;
