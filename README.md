# hitobito-ntfy

Push-Benachrichtigungen für JUBLA-Gruppen via [ntfy.sh](https://ntfy.sh), authentifiziert über hitobito OAuth.

## Funktionsweise

1. Einloggen mit dem JUBLA-hitobito-Konto (OAuth2 + PKCE)
2. App zeigt alle eigenen Gruppen und deren ntfy-Themen
3. Gruppenleitung kann Nachrichten an das Thema senden
4. Mitglieder können das ntfy-Thema abonnieren (App / Web-Push)

## ntfy-Thema setzen

Das ntfy-Thema wird in hitobito gepflegt — **kein eigener Datenspeicher**:

1. hitobito öffnen → Gruppe → *Weitere Angaben* → *Soziale Medien*
2. Neuer Eintrag: **Label** `ntfy`, **Wert** = Thema-Name (z. B. `jubla-wolfbach-news`)
3. Speichern — die App liest es beim nächsten Login automatisch

## Setup

### 1. OAuth-App in hitobito registrieren

In hitobito als Admin: *Einstellungen → OAuth-Applikationen → Neue Applikation*

- Name: `hitobito-ntfy`
- Redirect URI: `https://<dein-github-username>.github.io/hitobito-ntfy/` (oder `http://localhost:5173/` für lokal)
- Scopes: `with_roles`
- Als Public Client (kein Secret nötig dank PKCE)

### 2. Lokal entwickeln

```bash
cp .env.example .env
# .env ausfüllen (VITE_HITOBITO_URL, VITE_OAUTH_CLIENT_ID)
npm install
npm run dev
```

### 3. GitHub Pages deployen

1. Repository auf GitHub erstellen
2. *Settings → Pages → Source:* GitHub Actions
3. *Settings → Variables* (Repository Variables):
   - `HITOBITO_URL` = `https://db.jubla.ch`
   - `OAUTH_CLIENT_ID` = Client-ID aus Schritt 1
   - `BASE_URL` = `/hitobito-ntfy/` (Repo-Name mit Slashes)
4. Push zu `main` → automatisches Deploy

## Umgebungsvariablen

| Variable | Beschreibung | Standard |
|---|---|---|
| `VITE_HITOBITO_URL` | hitobito-Instanz URL | – |
| `VITE_OAUTH_CLIENT_ID` | OAuth Client-ID | – |
| `VITE_NTFY_BASE_URL` | ntfy-Server URL | `https://ntfy.sh` |
| `VITE_BASE_URL` | Vite base path (GitHub Pages) | `/` |

## Berechtigungen

Senden ist erlaubt für Rollen, deren Typ einen der folgenden Begriffe enthält (Gross-/Kleinschreibung egal):
`leitung`, `vorstand`, `praeses`, `präses`

Dies wird client-seitig anhand der hitobito-Rollendaten geprüft.

## Offene Punkte bei der Inbetriebnahme

- **PKCE ohne Secret**: Prüfen ob die hitobito-Instanz Public Clients (ohne client_secret) unterstützt
- **CORS**: Die hitobito API muss CORS-Anfragen vom GitHub Pages Origin erlauben
- **Rollennamen**: Exakte Rollennamen via `GET /api/v1/people/me?include=roles` prüfen und ggf. `SEND_ROLE_KEYWORDS` in `DashboardView.vue` und `SendView.vue` anpassen
