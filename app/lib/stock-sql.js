// lib/stock-sql.js
// Expression SQL réutilisable : stock actuel calculé depuis les mouvements.

const STOCK_EXPR = `
  COALESCE((
    SELECT SUM(
      CASE
        WHEN ms.type = 'entree' THEN ms.quantite
        WHEN ms.type IN ('sortie','vente') THEN -ms.quantite
        ELSE 0
      END
    )
    FROM mouvements_stock ms WHERE ms.produit_id = p.id
  ), 0)
`;

module.exports = { STOCK_EXPR, STOCK_SQL: STOCK_EXPR };
