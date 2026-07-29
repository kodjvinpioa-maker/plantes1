// lib/cloture.js
// Clôture automatique de la caisse chaque jour à une heure paramétrable
// (variable d'environnement CLOTURE_HEURE, 23 par défaut).

const cron = require('node-cron');
const db = require('../db');
const { logSysteme } = require('./activity');

const TZ = process.env.TZ_APP || 'Europe/Paris';

function dateDuJour() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calcule et enregistre la clôture d'une journée.
 * @param {string} jour  format YYYY-MM-DD
 * @param {boolean} automatique
 * @param {function} cb  (err, resume)
 */
function cloturerJournee(jour, automatique, cb) {
  const callback = cb || (() => {});

  db.get(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE 0 END), 0) AS total_entrees,
       COALESCE(SUM(CASE WHEN type = 'sortie' THEN montant ELSE 0 END), 0) AS total_sorties
     FROM mouvements_caisse WHERE date(date_mouvement) = date(?)`,
    [jour],
    (err, caisse) => {
      if (err) return callback(err);

      db.get(
        `SELECT COUNT(*) AS nb_ventes,
                COALESCE(SUM(quantite * COALESCE(prix_vente_effectif, 0)), 0) AS chiffre_affaires
         FROM mouvements_stock WHERE type = 'vente' AND date(date_mouvement) = date(?)`,
        [jour],
        (venteErr, ventes) => {
          if (venteErr) return callback(venteErr);

          db.get(
            `SELECT
               COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE 0 END), 0) -
               COALESCE(SUM(CASE WHEN type = 'sortie' THEN montant ELSE 0 END), 0) AS solde
             FROM mouvements_caisse WHERE date(date_mouvement) <= date(?)`,
            [jour],
            (soldeErr, soldeRow) => {
              if (soldeErr) return callback(soldeErr);

              const resume = {
                date_cloture: jour,
                total_entrees: caisse.total_entrees,
                total_sorties: caisse.total_sorties,
                solde_final: soldeRow.solde,
                nb_ventes: ventes.nb_ventes,
                chiffre_affaires: ventes.chiffre_affaires,
                automatique: automatique ? 1 : 0,
              };

              db.run(
                `INSERT INTO clotures_caisse
                   (date_cloture, total_entrees, total_sorties, solde_final, nb_ventes, chiffre_affaires, automatique)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(date_cloture) DO UPDATE SET
                   total_entrees = excluded.total_entrees,
                   total_sorties = excluded.total_sorties,
                   solde_final = excluded.solde_final,
                   nb_ventes = excluded.nb_ventes,
                   chiffre_affaires = excluded.chiffre_affaires,
                   automatique = excluded.automatique`,
                [
                  resume.date_cloture,
                  resume.total_entrees,
                  resume.total_sorties,
                  resume.solde_final,
                  resume.nb_ventes,
                  resume.chiffre_affaires,
                  resume.automatique,
                ],
                (insErr) => {
                  if (insErr) return callback(insErr);
                  callback(null, resume);
                }
              );
            }
          );
        }
      );
    }
  );
}

// Démarre la tâche planifiée (une fois, au démarrage du serveur)
function demarrerPlanificateur() {
  const heure = parseInt(process.env.CLOTURE_HEURE, 10);
  const h = Number.isInteger(heure) && heure >= 0 && heure <= 23 ? heure : 23;

  cron.schedule(
    `0 ${h} * * *`,
    () => {
      const jour = dateDuJour();
      cloturerJournee(jour, true, (err, resume) => {
        if (err) return console.error('Clôture automatique échouée :', err.message);
        console.log(`Clôture automatique du ${jour} : solde ${resume.solde_final}`);
        logSysteme(
          'cloture_automatique',
          `Caisse ${jour}`,
          `Solde final ${resume.solde_final} — ${resume.nb_ventes} vente(s), CA ${resume.chiffre_affaires}`
        );
      });
    },
    { timezone: TZ }
  );

  console.log(`Clôture automatique de caisse planifiée chaque jour à ${h}h00 (${TZ}).`);
}

module.exports = { cloturerJournee, demarrerPlanificateur, dateDuJour };
