// lib/upload.js
// Upload des photos produits. Le middleware est appliqué globalement dans
// server.js AVANT la protection CSRF : sans cela, le corps des formulaires
// multipart n'est pas analysé et le jeton CSRF est introuvable (erreur 403).

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, `produit-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    if (!ok) {
      const err = new Error('Format d\u2019image non supporté (JPG, PNG, WEBP ou GIF).');
      err.code = 'FICHIER_INVALIDE';
      return cb(err);
    }
    cb(null, true);
  },
});

// Analyse le champ "photo" de tout formulaire multipart (ignoré sinon).
const photoUpload = upload.single('photo');

module.exports = { photoUpload, UPLOAD_DIR };
