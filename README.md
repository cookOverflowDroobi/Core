<div align="center">

<img src="frontend/public/favicon.svg" width="72" height="72" alt="cookOverflow logo" />

# cookOverflow

**Cook what you have. Share what you love.**

A social recipe platform: share dishes, find recipes that match the ingredients already in your kitchen,
and cook along step by step.

![Django](https://img.shields.io/badge/Django-4.2-092E20?logo=django&logoColor=white)
![Django REST Framework](https://img.shields.io/badge/DRF-3.17-A30000)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow)

<img src="Documentation/screenshots/home.jpg" alt="The cookOverflow home feed" width="900" />

</div>

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Testing](#testing)
- [Project structure](#project-structure)
- [API](#api)
- [Background](#background)
- [Team and license](#team-and-license)

## Features

- **What can I cook?** Add the ingredients you have and every recipe is ranked by how much of it you can
  already make. Matched and missing ingredients are shown side by side, and missing ones go to your
  shopping list in one tap. The ingredient list lives in the URL, so a search can be shared.
  Different names for the same thing match ("garbanzo beans" finds chickpea recipes).
- **Scan your fridge.** Snap up to three photos and a vision model lists the ingredients it can see.
  You tick what's really there before it joins the search; guesses start unticked. Needs a Gemini API key.
- **Sous-chef, an AI cooking assistant.** Message it like any cook: "what can I make with chicken and rice?",
  "what's trending?", "how do I fix a split sauce?". It's an agent: before it answers, it searches the recipes
  cooks shared here and links them (`/posts/12`, or a ready-made *What can I cook?* search).
- **AI drafts, never AI posts.** *Draft with AI* in the composer turns your notes, photos and a video into a post
  or a full recipe (ingredients, steps with timings, tags) for you to check, with notes on what it guessed and an
  undo. In a chat, ✨ drafts your reply, or polishes your own rough words, looking up your recipes when someone asks.
  Nothing is posted or sent until you press the button. Works with a free Gemini key, GitHub Models, Groq, or Ollama
  on your own machine; see [AI](#ai).
- **Cook mode.** A full-screen, step-by-step view with large type. Durations in the steps ("simmer for
  40 minutes") become one-tap timers that keep running between steps and chime when done, and the
  screen stays awake while you cook.
- **Structured recipes.** Title, cuisine, time, servings, difficulty, ingredients and ordered steps,
  alongside photos, video and tags.
- **A feed that explains itself.** The *For you* tab learns from your likes, saves and comments and says
  why each post is there ("Because you like #italian"). There's also *Trending*, *Latest* and
  *Recipes*, plus who-to-follow suggestions.
- **Social.** Follow cooks, like, comment, save posts, get notifications and send direct messages.
- **Search everywhere.** Press <kbd>Ctrl</kbd> + <kbd>K</kbd> (or <kbd>/</kbd>) for a command palette
  that searches people, recipes and tags; press <kbd>N</kbd> to start a post.
- **Built with care.** Dark mode, a mobile layout with bottom navigation, instant (optimistic) likes and
  saves, infinite scroll, autosaved drafts, keyboard navigation, screen-reader labels and AA contrast.

## Screenshots

| What can I cook? | Cook mode |
| --- | --- |
| ![Recipes ranked by the ingredients you have](Documentation/screenshots/what-can-i-cook.jpg) | ![Full-screen, step-by-step cook mode](Documentation/screenshots/cook-mode.jpg) |
| **Recipe** | **Dark mode** |
| ![A recipe with ingredients and method](Documentation/screenshots/recipe.jpg) | ![What can I cook? in dark mode](Documentation/screenshots/dark-mode.jpg) |
| **Command palette** | **Sign in** |
| ![Ctrl+K search across people, recipes and tags](Documentation/screenshots/command-palette.jpg) | ![Sign-in page](Documentation/screenshots/sign-in.jpg) |

<p align="center">
  <img src="Documentation/screenshots/mobile-home.jpg" width="240" alt="Mobile home feed" />
  <img src="Documentation/screenshots/mobile-cook.jpg" width="240" alt="Mobile What can I cook?" />
  <img src="Documentation/screenshots/mobile-profile.jpg" width="240" alt="Mobile profile" />
</p>

## Tech stack

| Layer | Tools |
| --- | --- |
| Front end | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router, Lucide icons |
| Back end | Django 4.2, Django REST Framework, drf-spectacular (OpenAPI docs), WhiteNoise |
| Database | SQLite for local development, PostgreSQL supported |
| Tests | Django test runner, Vitest and Testing Library, Playwright driving Microsoft Edge |

The React app talks to the Django REST API with session cookies and CSRF protection. In development,
Vite serves the app on port 5173 and proxies `/api` and `/media` to Django. In production, Django
serves the built app itself.

## Getting started

You need **Python 3.13** and **Node.js 20 or newer**. Commands below are for Windows PowerShell; on
macOS or Linux use `.venv/bin/python` instead of `.venv\Scripts\python`.

**1. Back end** (from the project root)

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py seed_demo_data     # optional: 10 demo cooks and 100 posts
.venv\Scripts\python manage.py runserver
```

**2. Front end** (in `frontend/`)

```powershell
npm install
npm run dev
```

Open <http://localhost:5173>. On localhost, the sign-in page offers a one-click demo account
(`lina_haddad`, password `cookdemo123`, like every seeded account).

To run everything from Django alone, build once with `npm run build` and open <http://127.0.0.1:8000>.

| URL | What |
| --- | --- |
| `/` | The React app |
| `/api/docs/` | Interactive API documentation |
| `/admin/` | Django admin (create an account with `manage.py createsuperuser`) |
| `/legacy/` | The original Django-template site from 2022 |

**Demo traffic.** With the server running, `manage.py simulate_traffic --sessions 30` signs in as the
demo cooks and browses, likes, comments, follows and sends messages through the real endpoints.

## Configuration

Settings come from environment variables; [`.env.example`](.env.example) lists all of them with their
defaults. Nothing is required for local development.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | development key | Set a long random value in production |
| `DJANGO_DEBUG` | `true` | Set to `false` in production |
| `DJANGO_ALLOWED_HOSTS` | empty | Comma-separated host names |
| `DB_ENGINE` | SQLite | `postgres` to use PostgreSQL, with `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` |
| `EMAIL_BACKEND` | console | `django.core.mail.backends.smtp.EmailBackend` to send real mail |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | empty | SMTP login (for Gmail, use an app password) |
| `EMAIL_VERIFICATION_REQUIRED` | on only with SMTP | Require new accounts to confirm their email |
| `GEMINI_API_KEY` | empty | Turns on *Scan your fridge*. Each scan is one paid Gemini API call (30 per user per hour) |
| `COOK_SCAN_MODEL` | `gemini-3.1-flash-lite` | Gemini model that reads the photos |
| `AI_PROVIDER` | `gemini` | `gemini`, or `openai` for any OpenAI-compatible endpoint (see [AI](#ai)) |
| `AI_MODEL` | `gemini-3.8-flash` | Model for Sous-chef and the drafts |
| `AI_API_KEY` | `GEMINI_API_KEY` | Key for the AI provider (optional for a local Ollama) |
| `AI_BASE_URL` | empty | The OpenAI-compatible endpoint, such as `https://models.github.ai/inference` |
| `AI_MAX_VIDEO_MB` | `20` | Largest video sent to Gemini as it is; longer clips are sent as stills |

In local development, emails (such as password-reset links) are printed in the Django console, and
the reset page links to them directly.

### AI

Sous-chef and the AI drafts are off until a model is configured, and each reply or draft is one to five model
calls (60 per user per hour). There are free ways to run them:

| Option | Settings | Notes |
| --- | --- | --- |
| **Gemini** (default) | `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey) | Free tier, no card. Watches videos with their sound. The same key turns on the fridge scan |
| **GitHub Models** | `AI_PROVIDER=openai`, `AI_BASE_URL=https://models.github.ai/inference`, `AI_MODEL=openai/gpt-4.1-mini`, `AI_API_KEY=` a GitHub token with `models:read` | Free for GitHub accounts, low daily limits |
| **Groq** | `AI_PROVIDER=openai`, `AI_BASE_URL=https://api.groq.com/openai/v1`, a vision model, `AI_API_KEY` | Free tier, very fast |
| **Ollama** | `AI_PROVIDER=openai`, `AI_BASE_URL=http://localhost:11434/v1`, `AI_MODEL=qwen2.5vl` | Runs on your machine: no key, no data leaves it |

In PowerShell, set them before `runserver`, for example `$env:GEMINI_API_KEY = "..."`. Models behind the
`openai` setting can't watch video, so the browser picks stills from it and sends those.

The agents only read. Their tools search the posts the signed-in user could open anyway, and anything under your
name comes back as a draft. Sous-chef's own answers come from its own bot account (`sous_chef`), which can't sign in.

## Testing

```powershell
.venv\Scripts\python manage.py test api     # API tests
cd frontend
npm run typecheck                           # TypeScript
npm test                                    # unit tests (Vitest)
npm run e2e                                 # browser tests in Microsoft Edge; both servers must be running
```

The browser tests sign in through the UI, visit every page on desktop, mobile and dark mode, create and
delete a post, and use cook mode. They fail on any console error or failed request.

## Project structure

```text
.
├── api/                  REST API: views, serializers, recommendations, ingredient matching, AI agents, tests
├── frontend/             React app
│   ├── src/pages/        One file per screen
│   ├── src/components/   Layout, posts, composer, UI kit
│   ├── src/lib/          API client, queries, stores, helpers
│   └── e2e/              Browser tests
├── Account/  Profile/  Timeline/  communications/  notifications/  core/
│                         Django apps: models, admin, migrations and the legacy pages
├── cookOverflow/         Django settings and URLs
├── templates/  static/   Legacy Django-template site (served under /legacy/)
├── AI_Search_RecommenderSystem_R&D/
│                         Recipe datasets, scraper and recommender research
└── Documentation/        Report, presentation, UML diagrams and screenshots
```

## API

Browse and try every endpoint at `/api/docs/`. The main ones:

| Endpoint | Description |
| --- | --- |
| `POST /api/auth/register/`, `login/`, `logout/` | Accounts and sessions |
| `GET /api/auth/me/` | The signed-in user |
| `GET /api/posts/feed/` | Posts from people you follow |
| `GET /api/posts/for-you/`, `trending/` | Recommendations |
| `POST /api/posts/` | Create a post or recipe (multipart, with photos) |
| `POST`/`DELETE /api/posts/{id}/like/`, `save/` | Reactions |
| `GET /api/cook/?ingredients=rice,chicken` | Recipes ranked by the ingredients you have |
| `POST /api/cook/scan/` | Fridge photos (multipart `images`, up to 3) to a list of ingredients to confirm |
| `GET /api/ai/` | Whether AI is on, what the model can read, and Sous-chef's account |
| `POST /api/ai/post-draft/` | `prompt`, `images`, a `video` or its `frames` to a post or recipe draft |
| `POST /api/conversations/{username}/draft/` | A draft of your next message, optionally from your `hint` |
| `POST /api/conversations/sous_chef/reply/` | Sous-chef answers your latest messages |
| `GET /api/search/?q=` | People, posts and tags |
| `GET /api/notifications/`, `/api/conversations/` | Inbox |

## Background

cookOverflow began in 2022 as a senior graduation project: a food social network whose own data powers
a recipe recommender. You give it the ingredients you have, and it tells you what to cook.

The research behind it is in [`AI_Search_RecommenderSystem_R&D/`](AI_Search_RecommenderSystem_R&D): three
scraped recipe datasets, spaCy tokenization and TF-IDF modelling. The project report, presentation and
diagrams are in [`Documentation/`](Documentation).

The whole story, from the 2022 notebook to the 2030 Kitchen, is told in system-design diagrams in
[`Documentation/README.md`](Documentation/README.md).

<details>
<summary>Design diagrams</summary>

| | |
| --- | --- |
| Use cases ![Use case diagram](Documentation/UMLs/Use_Case_Diagram.jpeg) | Classes ![Class diagram](Documentation/UMLs/Class%20Daigram.jpeg) |
| Activity ![Activity diagram](Documentation/UMLs/Activity%20Diagram.jpeg) | Sequence ![Sequence diagram](Documentation/UMLs/Sequence%20diagram.jpeg) |
| States ![State chart](Documentation/UMLs/State%20Chart%20Diagram.jpeg) | Workflow ![Workflow](Documentation/UMLs/Workflow.png) |
| Search data flow ![Recipe data flow](Documentation/UMLs/RecipeDataFlowChart.png) | Model ![UML](Documentation/UMLs/UML.png) |

</details>

## Team and license

Built by **Ahmad Droobi** and **Ataa Shaqour**.

Released under the MIT License.
© Clemson University · © An-Najah National University · © Droobi and Shaqour
