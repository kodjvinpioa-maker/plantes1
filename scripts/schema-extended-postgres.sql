-- scripts/schema-extended-postgres.sql

-- Add soft-delete column and fournisseur link if not present
ALTER TABLE IF EXISTS produits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE IF EXISTS mouvements_stock ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE IF EXISTS mouvements_caisse ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add fournisseurs table
CREATE TABLE IF NOT EXISTS fournisseurs (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  contact TEXT,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  actif INTEGER DEFAULT 1,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add clients table
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  contact TEXT,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  notes TEXT,
  actif INTEGER DEFAULT 1,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link fournisseur to mouvements_stock (nullable)
ALTER TABLE IF EXISTS mouvements_stock ADD COLUMN IF NOT EXISTS fournisseur_id INTEGER REFERENCES fournisseurs(id);

-- Approvisionnements (session)
CREATE TABLE IF NOT EXISTS approvisionnements (
  id SERIAL PRIMARY KEY,
  fournisseur_id INTEGER REFERENCES fournisseurs(id),
  user_id INTEGER REFERENCES users(id),
  etat TEXT CHECK (etat IN ('draft','validated','cancelled')) DEFAULT 'draft',
  total DOUBLE PRECISION DEFAULT 0,
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_validated TIMESTAMP,
  commentaire TEXT
);

CREATE TABLE IF NOT EXISTS approvisionnement_items (
  id SERIAL PRIMARY KEY,
  appro_id INTEGER REFERENCES approvisionnements(id) ON DELETE CASCADE,
  produit_id INTEGER REFERENCES produits(id),
  quantite DOUBLE PRECISION NOT NULL,
  prix_achat DOUBLE PRECISION,
  montant DOUBLE PRECISION
);
