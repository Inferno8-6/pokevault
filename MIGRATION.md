# Guide de Migration - PokeVault

## Transfert vers un autre PC

### Prerequis sur le nouveau PC
- **Node.js** v20+ (https://nodejs.org)
- **Git** (https://git-scm.com)
- **pnpm** : `npm install -g pnpm`

### Etape 1 : Copier le projet

Option A - Via cle USB / disque externe :
```
Copiez le dossier `pokemon-cards-platform` SAUF `node_modules/` et `.next/`
```

Option B - Via Git (recommande) :
```bash
# Sur le PC actuel, si pas deja fait :
cd C:\Users\kbv58\pokemon-cards-platform
git init
git add -A
git commit -m "PokeVault MVP"
git remote add origin https://github.com/VOTRE_USER/pokemon-cards-platform.git
git push -u origin main

# Sur le nouveau PC :
git clone https://github.com/VOTRE_USER/pokemon-cards-platform.git
cd pokemon-cards-platform
```

### Etape 2 : Installer les dependances
```bash
cd pokemon-cards-platform
pnpm install
```

### Etape 3 : Configurer l'environnement

Copiez le fichier `.env` depuis l'ancien PC, ou recreez-le :
```bash
cp .env.example .env
```

Remplissez les valeurs :
- `DATABASE_URL` : votre URL Neon (ne change pas, c'est dans le cloud)
- `DISCORD_TOKEN` : votre token bot Discord (ne change pas)
- `DISCORD_CLIENT_ID` : votre client ID Discord (ne change pas)
- `DISCORD_CLIENT_SECRET` : votre client secret Discord (ne change pas)
- `NEXTAUTH_URL` : http://localhost:3001 (ou le port que vous utilisez)
- `NEXTAUTH_SECRET` : votre secret (ne change pas)

**IMPORTANT** : Le fichier `.env` contient des secrets. Ne le commitez JAMAIS sur Git.
Il est deja dans le `.gitignore`.

### Etape 4 : Synchroniser .env vers les sous-projets
```bash
copy .env apps\web\.env
copy .env apps\bot\.env
copy .env packages\db\.env
```

### Etape 5 : Generer le client Prisma
```bash
pnpm db:generate
```

### Etape 6 : Lancer !
```bash
# Double-cliquez sur lancer_pokevault.bat
# Ou manuellement :
# Terminal 1 - Dashboard :
cd apps\web
set NODE_OPTIONS=--no-experimental-webstorage
npx next dev --port 3001

# Terminal 2 - Bot Discord :
pnpm --filter @pokemon/bot dev
```

### Ce qui est dans le cloud (rien a migrer)
- **Base de donnees** : Neon PostgreSQL (cloud, accessible partout)
- **Donnees utilisateur** : stockees dans Neon
- **Prix des cartes** : via API Pokemon TCG (pas de stockage local)

### Ce qui est local (a copier)
- **Code source** : le dossier `pokemon-cards-platform`
- **Fichier .env** : les cles API et secrets
- **node_modules** : PAS besoin de copier (reinstalle avec `pnpm install`)

### Si vous changez de PC regulierement
Utilisez Git + GitHub pour synchroniser le code entre les machines.
Le `.env` doit etre copie manuellement (jamais sur Git).

### Redirection Discord OAuth
Si le nouveau PC utilise un port different :
1. Allez sur https://discord.com/developers/applications
2. Votre app > OAuth2 > Redirects
3. Ajoutez : `http://localhost:VOTRE_PORT/api/auth/callback/discord`
4. Mettez a jour `NEXTAUTH_URL` dans `.env`

### En cas de probleme
```bash
# Reinstaller les dependances
rm -rf node_modules
pnpm install

# Regenerer Prisma
pnpm db:generate

# Resynchroniser la DB
pnpm db:push

# Verifier la connexion DB
npx tsx packages/db/test-connection.ts
```
