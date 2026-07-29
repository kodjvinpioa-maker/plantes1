// routes/assistant.js
// Assistant intelligent spécialisé plantes : conseils d'entretien, maladies,
// arrosage, rempotage... Utilise un modèle d'IA si une clé est configurée,
// sinon une base de connaissances locale (fonctionne sans configuration).

const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { log } = require('../lib/activity');

const SYSTEM_PROMPT = `Tu es l'assistant botanique d'une boutique de plantes.
Tu réponds en français, de façon chaleureuse, concrète et concise (5 phrases maximum,
listes à puces bienvenues). Tu aides sur l'entretien des plantes, l'arrosage, la lumière,
le rempotage, les maladies et parasites, et les conseils de vente aux clients.
Si une question sort du domaine des plantes ou de la boutique, tu le dis gentiment.`;

// --- Base de connaissances locale (repli sans clé d'IA) ---------------------
const FAQ = [
  {
    motsCles: ['arros', 'eau', 'boire', 'humid'],
    reponse:
      "Arrosage : vérifiez toujours la terre avant d'arroser (enfoncez un doigt sur 2-3 cm). " +
      "Arrosez seulement quand la surface est sèche, abondamment, puis videz la soucoupe. " +
      "En hiver, espacez fortement les arrosages : l'excès d'eau est la première cause de mort des plantes d'intérieur.",
  },
  {
    motsCles: ['jaun', 'feuille jaune', 'jaunisse'],
    reponse:
      "Feuilles jaunes : le plus souvent un excès d'eau (terre détrempée, tiges molles) ou un manque de lumière. " +
      "Laissez sécher la terre, vérifiez le drainage du pot et rapprochez la plante d'une fenêtre lumineuse sans soleil direct brûlant.",
  },
  {
    motsCles: ['brun', 'sèche', 'seche', 'pointe'],
    reponse:
      "Pointes brunes et sèches : air trop sec, courant d'air chaud ou eau calcaire. " +
      "Brumisez le feuillage, éloignez la plante des radiateurs et utilisez de l'eau à température ambiante, si possible non calcaire.",
  },
  {
    motsCles: ['puceron', 'cochenille', 'araignée', 'araignee', 'parasite', 'insecte', 'moucheron'],
    reponse:
      "Parasites : isolez la plante. Pucerons et cochenilles se traitent au savon noir dilué (1 c. à soupe / litre) pulvérisé 2 fois à 7 jours d'écart. " +
      "Cochenilles farineuses : tamponnez à l'alcool à 70°. Araignées rouges : augmentez l'humidité, elles détestent l'eau. " +
      "Moucherons du terreau : laissez sécher la surface et posez des pièges jaunes.",
  },
  {
    motsCles: ['maladie', 'champignon', 'oïdium', 'oidium', 'mildiou', 'tache', 'pourri'],
    reponse:
      "Maladies fongiques : retirez les feuilles atteintes, aérez, espacez les plantes et évitez de mouiller le feuillage. " +
      "Le purin de prêle ou une bouillie bordelaise (en extérieur) limite la propagation. Une pourriture des racines impose un rempotage dans un terreau neuf et drainant.",
  },
  {
    motsCles: ['rempot', 'pot', 'terreau', 'substrat'],
    reponse:
      "Rempotage : au printemps, dans un pot 2-4 cm plus large, percé. Mélange conseillé : terreau + 20 % de perlite ou de sable pour le drainage. " +
      "Démêlez délicatement les racines, n'enterrez pas le collet et arrosez modérément la première semaine.",
  },
  {
    motsCles: ['lumière', 'lumiere', 'soleil', 'ombre', 'exposition'],
    reponse:
      "Lumière : la plupart des plantes vertes adorent une lumière vive indirecte (près d'une fenêtre est ou ouest). " +
      "Cactées et succulentes veulent du plein soleil ; sansevières, zamioculcas et pothos tolèrent l'ombre.",
  },
  {
    motsCles: ['engrais', 'nourri', 'fertilis'],
    reponse:
      "Engrais : de mars à septembre, un engrais liquide toutes les 2-3 semaines à demi-dose. Pas d'engrais en hiver ni sur une plante fraîchement rempotée.",
  },
  {
    motsCles: ['orchidée', 'orchidee', 'phalaenopsis'],
    reponse:
      "Orchidée (Phalaenopsis) : bain de 10 minutes tous les 7-10 jours, puis égouttage complet. Lumière vive sans soleil direct. " +
      "Après floraison, coupez la hampe au-dessus du 2e œil pour relancer une floraison.",
  },
  {
    motsCles: ['succulente', 'cactus', 'grasse'],
    reponse:
      "Cactées et succulentes : substrat très drainant, plein soleil, arrosage seulement quand la terre est totalement sèche (env. 2-3 semaines), quasi nul en hiver.",
  },
];

function reponseLocale(question) {
  const q = (question || '').toLowerCase();
  const trouvees = FAQ.filter((f) => f.motsCles.some((m) => q.includes(m)));

  if (trouvees.length) {
    return trouvees.slice(0, 2).map((f) => f.reponse).join('\n\n');
  }

  return (
    "Je peux vous conseiller sur l'arrosage, la lumière, le rempotage, les engrais, " +
    'les maladies et les parasites (pucerons, cochenilles, araignées rouges), ainsi que sur des plantes ' +
    "précises comme les orchidées ou les succulentes. Reformulez votre question en précisant la plante et le symptôme observé " +
    '(feuilles jaunes, taches, pointes sèches...).'
  );
}

// --- Appel au modèle d'IA (optionnel) --------------------------------------
async function reponseIA(question, historique) {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  (historique || []).slice(-6).forEach((m) => {
    if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
      messages.push({ role: m.role, content: m.content.slice(0, 2000) });
    }
  });
  messages.push({ role: 'user', content: question });

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.AI_API_KEY || process.env.OPENAI_API_KEY) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    headers['Lovable-API-Key'] = apiKey;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: 500 }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Assistant IA :', response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const texte = data && data.choices && data.choices[0] && data.choices[0].message;
    return texte ? texte.content : null;
  } catch (err) {
    console.error('Assistant IA indisponible :', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Routes -----------------------------------------------------------------
router.get('/assistant', requireLogin, (req, res) => {
  res.render('assistant/index', {
    title: 'Assistant plantes',
    csrfToken: req.csrfToken(),
    iaActive: Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.LOVABLE_API_KEY),
  });
});

router.post('/assistant/message', requireLogin, async (req, res) => {
  const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';

  if (!question || question.length > 1000) {
    return res.status(400).json({ error: 'Question invalide (1 à 1000 caractères).' });
  }

  const historique = Array.isArray(req.body.historique) ? req.body.historique : [];
  let reponse = await reponseIA(question, historique);
  let source = 'ia';

  if (!reponse) {
    reponse = reponseLocale(question);
    source = 'local';
  }

  log(req, 'assistant', 'Assistant plantes', question.slice(0, 200));
  res.json({ reponse, source });
});

module.exports = router;
