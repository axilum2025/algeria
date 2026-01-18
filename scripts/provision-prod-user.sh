#!/usr/bin/env bash
set -euo pipefail

# Provisionne un compte utilisateur en PRODUCTION via les endpoints admin "Instant Code".
# - Ne dépend pas de SendGrid
# - Ne stocke pas le mot de passe dans un fichier
# - Nécessite que la prod ait: INSTANT_CODE_ENABLED=1 et ADMIN_API_KEY défini
#
# Variables requises:
#   APP_URL        ex: https://<votre-app>.azurestaticapps.net
#   EMAIL          ex: user@example.com
# Optionnel:
#   ADMIN_API_KEY  si l'endpoint est protégé (recommandé en prod)
# Optionnel:
#   DISPLAY_NAME   ex: "Prénom Nom" (défaut: EMAIL)
#
# Exemple:
#   APP_URL="https://..." ADMIN_API_KEY="..." EMAIL="..." DISPLAY_NAME="..." ./scripts/provision-prod-user.sh

need() {
  if [[ -z "${!1:-}" ]]; then
    echo "❌ Variable manquante: $1" >&2
    exit 2
  fi
}

need APP_URL
need EMAIL

DISPLAY_NAME="${DISPLAY_NAME:-$EMAIL}"

APP_URL="${APP_URL%/}"

echo "🔐 Provisionnement utilisateur sur: $APP_URL"
echo "👤 Email: $EMAIL"

# 1) Générer un code instant (admin-only)
code_json="$(
  node - <<'NODE'
const appUrl = process.env.APP_URL;
const adminKey = (process.env.ADMIN_API_KEY || '').trim();
const email = process.env.EMAIL;
const displayName = process.env.DISPLAY_NAME || email;

async function main() {
  const url = `${appUrl.replace(/\/$/, '')}/api/generate-instant-code`;
  const headers = { 'Content-Type': 'application/json' };
  if (adminKey) headers['X-Admin-Api-Key'] = adminKey;
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ username: email, displayName })
  });

  const text = await resp.text();
  if (!resp.ok) {
    console.error(`HTTP ${resp.status} ${resp.statusText}`);
    console.error(text);
    process.exit(3);
  }

  process.stdout.write(text);
}

main().catch((e) => {
  console.error(String(e && e.stack || e));
  process.exit(3);
});
NODE
)"

instant_code="$(node -e "try{const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.code||''))}catch(e){process.stdout.write('')}" "$code_json")"

if [[ -z "$instant_code" ]]; then
  echo "❌ Impossible de récupérer le code depuis /api/generate-instant-code." >&2
  echo "   Vérifie que INSTANT_CODE_ENABLED=1 en prod, et que ADMIN_API_KEY correspond." >&2
  exit 3
fi

echo "✅ Code instant généré (non affiché)"

# 2) Lire le mot de passe sans l'afficher
read -r -s -p "🔑 Mot de passe (ne s'affiche pas): " AX_PASS
echo
if [[ -z "${AX_PASS}" ]]; then
  echo "❌ Mot de passe vide." >&2
  exit 2
fi

# 3) Vérifier le code + créer l'utilisateur
verify_json="$(
  node - <<'NODE'
const appUrl = process.env.APP_URL;
const adminKey = (process.env.ADMIN_API_KEY || '').trim();
const email = process.env.EMAIL;
const displayName = process.env.DISPLAY_NAME || email;
const code = process.env.INSTANT_CODE;
const password = process.env.AX_PASS;

async function main() {
  const url = `${appUrl.replace(/\/$/, '')}/api/verify-instant-code`;
  const headers = { 'Content-Type': 'application/json' };
  if (adminKey) headers['X-Admin-Api-Key'] = adminKey;
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ username: email, code, password, displayName })
  });

  const text = await resp.text();
  if (!resp.ok) {
    console.error(`HTTP ${resp.status} ${resp.statusText}`);
    console.error(text);
    process.exit(4);
  }

  process.stdout.write(text);
}

main().catch((e) => {
  console.error(String(e && e.stack || e));
  process.exit(4);
});
NODE
)"

verified="$(node -e "try{const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.verified||''))}catch(e){process.stdout.write('')}" "$verify_json")"

if [[ "$verified" != "true" ]]; then
  echo "❌ Création utilisateur échouée." >&2
  echo "$verify_json" >&2
  exit 4
fi

echo "✅ Utilisateur créé. Tu peux maintenant te connecter via l'UI (Se connecter) en prod."

# 4) Test login (best-effort)
echo
echo "🔎 Test connexion (best-effort)"
node - <<'NODE' || true
const appUrl = process.env.APP_URL;
const email = process.env.EMAIL;
const password = process.env.AX_PASS;

async function main() {
  const url = `${appUrl.replace(/\/$/, '')}/api/auth-login`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const text = await resp.text();
  if (!resp.ok) {
    console.log(`Login HTTP ${resp.status}`);
    console.log(text);
    return;
  }
  try {
    const j = JSON.parse(text);
    console.log(j && j.success ? '✅ Login OK' : '⚠️ Login réponse inattendue');
  } catch {
    console.log('⚠️ Login: réponse non-JSON');
  }
}

main().catch(() => {});
NODE

echo
echo "🔒 Recommandé après test: remettre INSTANT_CODE_ENABLED=0 en prod."
