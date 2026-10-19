# governo-it-frontend

Frontend del **Master Plan IT** di Marlù (progetto "Governo IT"): applicazione Angular che usa le API REST del backend `governo-it-backend`.

## Stack

| Componente | Versione |
|---|---|
| Angular | 22 (componenti standalone, signals, nuovo control flow) |
| Angular Material | 22 (tema Material 3) |
| Stili | SCSS, CSS Grid e Flexbox, approccio **mobile first** |
| Qualità | ESLint (angular-eslint, regole di accessibilità) + Prettier |
| Test | Vitest |
| Node.js | 24 LTS |

## Struttura

```
src/app
├── core/                     servizi e infrastruttura usati una sola volta nell'app
│   ├── auth/                 AuthService, authInterceptor, authGuard
│   ├── config/               configurazione (URL base delle API)
│   ├── layout/shell/         struttura: barra superiore, menu, area contenuti
│   └── models/               modelli condivisi (utente corrente)
├── shared/                   componenti di presentazione riutilizzabili
│   └── components/page-header/
└── features/                 aree funzionali, caricate solo quando servono (lazy loading)
    ├── auth/login/
    ├── home/
    └── project-statuses/     models/ · services/ · components/ (presentazione) · pages/ (smart)
```

Con Angular moderno i *Core / Shared / Feature Modules* sono realizzati come **cartelle di componenti standalone** invece che come `NgModule`: stessa separazione delle responsabilità, meno codice di contorno.

Ogni area funzionale separa:
- **pagine (smart component)**: caricano i dati tramite i servizi e gestiscono lo stato;
- **componenti di presentazione**: ricevono i dati con `input()` e non chiamano API.

## Responsive

| Dispositivo | Larghezza | Comportamento |
|---|---|---|
| Smartphone | < 600px | menu a scomparsa, elenchi a schede, nome utente nascosto |
| Tablet | 600–1023px | menu a scomparsa, tabelle da 768px |
| Desktop | ≥ 1024px | menu laterale sempre visibile |

## Accessibilità (WCAG 2.1 AA)

Link "Vai al contenuto", focus sempre visibile, etichette ARIA sui pulsanti a sola icona, errori dei form annunciati agli screen reader (`role="alert"`), `lang="it"`, rispetto della preferenza di sistema per ridurre le animazioni. ESLint applica le regole `templateAccessibility`.

## Sviluppo

Prerequisiti: Node.js 24, backend avviato su http://localhost:8080 (vedi README del backend).

| Comando | Effetto |
|---|---|
| `npm start` | avvia l'app su http://localhost:4200; le chiamate `/api` passano dal proxy (`proxy.conf.json`) al backend |
| `npm run build` | build di produzione in `dist/` |
| `npm test` | test con Vitest |
| `npm run lint` | ESLint |
| `npm run format` / `npm run format:check` | formatta / verifica la formattazione con Prettier |

## Login

Fase di test (decisione D-02): utente e password locali, verificati dal backend con `GET /api/v1/auth/me`. Le credenziali restano solo nella scheda del browser (`sessionStorage`). In fase 2 il login passerà a Microsoft Entra ID: cambierà `AuthService`, non le pagine.
