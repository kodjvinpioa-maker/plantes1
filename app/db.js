// db.js
// Initialisation SQLite : création des tables, migrations légères et seed.

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base de données :', err.message);
    process.exit(1);
  }
  console.log('Connecté à la base de données SQLite :', DB_PATH);
});

db.run('PRAGMA foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin','collaborateur')) NOT NULL DEFAULT 'collaborateur',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  seuil_alerte INTEGER DEFAULT 0,
  prix_vente REAL,
  prix_achat REAL,
  photo_url TEXT,
  actif INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mouvements_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('entree','sortie','vente')) NOT NULL,
  produit_id INTEGER REFERENCES produits(id),
  quantite REAL NOT NULL,
  prix_vente_effectif REAL,
  prix_achat_effectif REAL,
  date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id),
  commentaire TEXT
);

CREATE TABLE IF NOT EXISTS mouvements_caisse (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('entree','sortie')) NOT NULL,
  montant REAL NOT NULL,
  motif TEXT,
  est_lie_vente INTEGER DEFAULT 0,
  vente_id INTEGER REFERENCES mouvements_stock(id) ON DELETE SET NULL,
  date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id),
  commentaire TEXT
);

CREATE TABLE IF NOT EXISTS journal_activite (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  cible TEXT,
  details TEXT,
  date_action DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clotures_caisse (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_cloture TEXT UNIQUE NOT NULL,
  total_entrees REAL NOT NULL DEFAULT 0,
  total_sorties REAL NOT NULL DEFAULT 0,
  solde_final REAL NOT NULL DEFAULT 0,
  nb_ventes INTEGER NOT NULL DEFAULT 0,
  chiffre_affaires REAL NOT NULL DEFAULT 0,
  automatique INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ms_date ON mouvements_stock(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_mc_date ON mouvements_caisse(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_activite(date_action);
`;

// Migrations légères : ajoute les colonnes manquantes sur une base existante.
function migrate(cb) {
  const alters = [
    'ALTER TABLE produits ADD COLUMN photo_url TEXT',
    'ALTER TABLE mouvements_stock ADD COLUMN prix_achat_effectif REAL',
  ];
  let done = 0;
  alters.forEach((sql) => {
    db.run(sql, () => {
      // Erreur ignorée : la colonne existe déjà.
      if (++done === alters.length && cb) cb();
    });
  });
}

function init() {
  db.serialize(() => {
    db.exec(SCHEMA, (err) => {
      if (err) {
        console.error('Erreur lors de la création des tables :', err.message);
        return;
      }
      migrate(seedUsers);
    });
  });
}

function seedUsers() {
  db.get('SELECT COUNT(*) AS count FROM users', (err, row) => {
    if (err) return console.error('Erreur seed :', err.message);
    if (row.count > 0) return;

    const saltRounds = 10;
    const comptes = [
      { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: process.env.ADMIN_PASSWORD || 'admin123', role: 'admin' },
      { email: 'collab@example.com', password: 'collab123', role: 'collaborateur' },
    ];

    comptes.forEach((u) => {
      bcrypt.hash(u.password, saltRounds, (hashErr, hash) => {
        if (hashErr) return console.error('Erreur de hashage :', hashErr.message);
        db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [u.email, hash, u.role], (insErr) => {
          if (insErr) console.error(`Erreur création ${u.email} :`, insErr.message);
          else console.log(`Utilisateur créé : ${u.email} (${u.role})`);
        });
      });
    });
  });
}

init();

module.exports = db;
