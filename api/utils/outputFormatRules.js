// Shared output formatting rules injected into system prompts.
// Keep wording simple and consistent across agents.

const OUTPUT_FORMAT_RULES_BULLET = `

Contraintes de format:
- N'utilise PAS de tableaux (ni tableaux Markdown du type "|...|" / "|---|", ni balises HTML <table>).
- Préfère des listes à puces, des sections courtes, ou des paires "Titre: valeur".
- Si tu as besoin de précisions pour mieux répondre, donne d'abord une réponse utile avec des hypothèses raisonnables, puis pose 1-3 questions courtes à la FIN.`;

const OUTPUT_FORMAT_RULES_LINES =
  `Format: n'utilise PAS de tableaux (ni Markdown "|...|"/"|---|", ni <table>). Utilise plutôt des listes à puces ou des sections courtes.\n` +
  `Clarification: si des infos manquent, répond d'abord avec des hypothèses raisonnables, puis pose 1-3 questions courtes à la fin.\n`;

module.exports = {
  OUTPUT_FORMAT_RULES_BULLET,
  OUTPUT_FORMAT_RULES_LINES
};
