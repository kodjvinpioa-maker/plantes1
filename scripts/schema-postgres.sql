-- scripts/schema-postgres.sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin','collaborateur','superadmin')) NOT NULL DEFAULT 'collaborateur',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produits (
  id SERIAL PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  seuil_alerte INTEGER DEFAULT 0,
  prix_vente DOUBLE PRECISION,
  prix_achat DOUBLE PRECISION,
  photo_url TEXT,
  actif INTEGER DEFAULT 1,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mouvements_stock (
  id SERIAL PRIMARY KEY,
  type TEXT CHECK (type IN ('entree','sortie','vente')) NOT NULL,
  produit_id INTEGER REFERENCES produits(id),
  quantite DOUBLE PRECISION NOT NULL,
  prix_vente_effectif DOUBLE PRECISION,
  prix_achat_effectif DOUBLE PRECISION,
  date_mouvement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id),
  commentaire TEXT,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mouvements_caisse (
  id SERIAL PRIMARY KEY,
  type TEXT CHECK (type IN ('entree','sortie')) NOT NULL,
  montant DOUBLE PRECISION NOT NULL,
  motif TEXT,
  est_lie_vente INTEGER DEFAULT 0,
  vente_id INTEGER REFERENCES mouvements_stock(id) ON DELETE SET NULL,
  date_mouvement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id),
  commentaire TEXT,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_activite (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  cible TEXT,
  details TEXT,
  date_action TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clotures_caisse (
  id SERIAL PRIMARY KEY,
  date_cloture TEXT UNIQUE NOT NULL,
  total_entrees DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_sorties DOUBLE PRECISION NOT NULL DEFAULT 0,
  solde_final DOUBLE PRECISION NOT NULL DEFAULT 0,
  nb_ventes INTEGER NOT NULL DEFAULT 0,
  chiffre_affaires DOUBLE PRECISION NOT NULL DEFAULT 0,
  automatique INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ms_date ON mouvements_stock(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_mc_date ON mouvements_caisse(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_activite(date_action);
