// app/db.js
// Wrapper DB : utilise Postgres si DATABASE_URL présent, sinon SQLite (compatibilité descendante).
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || null;

if (DATABASE_URL) {
  // --- Postgres implementation using node-postgres, but expose get/all/run like sqlite3 ---
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: (process.env.DB_SSL === 'true') ? { rejectUnauthorized: false } : false });

  function all(sql, params = [], cb) {
    pool.query(sql, params)
      .then(result => cb(null, result.rows))
      .catch(err => cb(err));
  }

  function get(sql, params = [], cb) {
    pool.query(sql, params)
      .then(result => cb(null, result.rows[0] || null))
      .catch(err => cb(err));
  }

  function run(sql, params = [], cb) {
    pool.query(sql, params)
      .then(result => {
        // return an object similar to sqlite's callback: { lastID, changes }
        const lastID = (result.rows && result.rows[0] && (result.rows[0].id || result.rows[0].lastid)) ? (result.rows[0].id || result.rows[0].lastid) : null;
        cb && cb(null, { lastID, rowCount: result.rowCount, rows: result.rows });
      })
      .catch(err => cb && cb(err));
  }

  function exec(sql, cb) {
    pool.query(sql)
      .then(() => cb && cb(null))
      .catch(err => cb && cb(err));
  }

  module.exports = { all, get, run, exec, _rawPool: pool };
} else {
  // --- fallback SQLite (existing) ---
  const sqlite3 = require('sqlite3').verbose();
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');

  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Erreur lors de la connexion à la base de données :', err.message);
      process.exit(1);
    }
    console.log('Connecté à SQLite :', DB_PATH);
  });

  db.run('PRAGMA foreign_keys = ON');

  module.exports = {
    all: (sql, params, cb) => db.all(sql, params, cb),
    get: (sql, params, cb) => db.get(sql, params, cb),
    run: (sql, params, cb) => db.run(sql, params, function (err) { if (cb) cb(err, { lastID: this.lastID, changes: this.changes }); }),
    exec: (sql, cb) => db.exec(sql, cb),
    _rawDb: db,
  };
}
