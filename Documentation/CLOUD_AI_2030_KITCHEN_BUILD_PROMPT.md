# Cloud AI build prompt — cookOverflow 2030 Kitchen

## How to use this
1. Open Claude Code, Cursor Composer, v0, or Lovable.
2. Attach this file plus `AI_Search_RecommenderSystem_R&D/` (notebook + `recipes_raw_nosource_*.json`). If the dumps are too large, attach a 500–2000 row subset with `title`, `ingredients[]`, `instructions`, `tags[]`.
3. Optionally attach `api/ingredients.py` from cookOverflow Core so coverage ranking matches production.
4. Paste **everything under the next horizontal rule**. Tell the agent: deploy the web app to Vercel and the API to Railway / Render / Fly.
5. If the agent starts calling OpenAI / Gemini to pick meals, stop it and re-paste §0 Non-negotiables.

## Why two rankers (read this, then ignore it while the agent builds)
The 2022 notebook used **TF-IDF cosine** — “find writeups that sound like this query.” Production cookOverflow used **pantry coverage** — “what fraction of this recipe is already in my fridge.” A fridge opening is a coverage question. A typed craving (“something like shakshuka”) is a TF-IDF question. The app ships both. Default on a chip-list is coverage. No LLM does either job.

---

You are a principal full-stack engineer and interaction designer. Build and deploy a single-purpose product:

**2030 Kitchen — an animated refrigerator that opens, asks what you have and what you want, and recommends meals from OUR recipe corpus using classical IR (TF-IDF) and pantry-coverage ranking. No large language model picks recipes.**

This is not a chatbot. This is not SnapFridge. This is not a calorie app. It is a beautiful one-page kitchen whose brain is the 2022 cookOverflow R&D notebook (TF-IDF / optional NMF / TextRank) plus the production cook coverage ranker.

---

## 0. Non-negotiables

1. **The recommender is not an LLM.** Recipe ranking must be deterministic sklearn / Python: TF-IDF cosine and/or pantry coverage. You may use an LLM only to help *you* write code while building. The running app never calls OpenAI / Anthropic / Gemini / Grok to choose a meal.
2. **Vision is a future socket, not v1 intelligence.** Image and camera buttons exist in the UI and hit `POST /api/scan`. v1 returns a fixture or `501` with the frozen JSON contract below. A local VLM (MiniCPM-V, Gemma 3 vision, Qwen2-VL) will be plugged in later on the user’s machine. Do not send fridge pixels to a cloud VLM in v1.
3. **Corpus is ours.** Recipes come from the attached R&D JSON dumps (`recipes_raw_nosource_*.json`) or a trimmed subset you generate at build time. Do **not** call Spoonacular, Edamam, or any third-party recipe API.
4. **No grams, no generated recipes, no calorie theatre.** The VLM (later) emits ingredient *names*. The ranker emits existing recipes with `matched[]` / `missing[]`.
5. **One page.** Landing *is* the kitchen. No dashboard maze.

---

## 1. Product story (build these states exactly)

The page is a dim, warm, photoreal-enough 3D-ish kitchen at dusk. Center stage: a freestanding refrigerator.

| State | What the user sees | Motion |
|---|---|---|
| **S0 Closed** | Kitchen ambient. Fridge closed. Handle has a slow pulse of light. Tiny caption: “Open the fridge.” | Idle parallax on steam / under-cabinet LEDs |
| **S1 Opening** | Click / tap the handle (or press Space). Doors swing open on a perspective hinge. Interior light blooms. Shelves faintly visible (milk, greens, jars — decorative, not inventory). | 600–900ms spring. Soft whoosh. Do not block input after 300ms |
| **S2 Ask ingredients** | A glass search bar **rises from behind the top of the open doors** and docks above the fridge. Placeholder: **“What ingredients do you have today?”** Chip field under it. | Bar eases up 24px past the door crown |
| **S3 Ask intent** | Second line, quieter: **“What do you want to eat?”** Tag pills: Levantine · Vegan · Vegetarian · 30-min · High-protein · Comfort · Breakfast · Order-in · Use it up |
| **S4 Pantry fills** | Typed tokens become chips. Comma / Enter commits. Backspace removes. Paste `"eggs, labneh, pita, tomato"` works. Photo / camera buttons sit on the crisper drawer. | Chips stack like magnets on the door |
| **S5 Counter results** | Recipe cards slide onto the counter *in front of* the open fridge. Each card: title, 3–5 used ingredients, missing ingredients (if any), coverage %, cuisine tags, “Cook” / “Shop missing”. | Stagger 60ms per card |
| **S6 Shop** | Missing chips collect on a paper-tape list on the counter. Buttons: **Uber Eats** · **Instacart** · Copy list. These are **deep-link stubs** (`https://www.ubereats.com/search?q=...`) plus clipboard. No fake checkout. |
| **S7 Photo (disabled-ready)** | Camera icon on the crisper. Tooltip: “Local vision model — connect later.” Clicking in v1 either loads a fixture pantry (`tomato, egg, onion, pita, labneh`) so the pipeline can be demoed, or shows a tasteful empty state: “Drop a fridge photo when your local VLM is running.” Same chip contract as typed input. |

Microcopy voice: warm, short, never cutesy. Default greeting after open: “What is in there today?”

---

## 2. Visual direction — 2030 automation kitchen

- Palette: warm stone `#E8DCC8`, night steel `#1A1D21`, interior fridge light `#F7F1E3`, accent saffron `#E0A100`, produce green `#3F6B4D`, danger-missing `#C45C4A`.
- Typography: one display serif for headlines (Fraunces or Instrument Serif), one geometric sans for UI (Geist / Söhne / Inter).
- Motion: Framer Motion. Door uses `rotateY` with `perspective: 1600px` and a shadow that lengthens as it opens. Reduce-motion: skip 3D, fade the bar in.
- Not a flat illustration of a fridge on a white page. The kitchen is the chrome. Cards feel like recipe cards left on a marble counter.
- Dark-first. Light mode optional.
- Mobile: fridge scales down; door still opens; search bar docks under the status bar; cards become a vertical deck.
- Accessibility: handle is a real `<button>`, focus trap none (one page), chips have aria-labels, contrast ≥ 4.5:1 on text.

Reference energy (do not copy assets): a quiet Pentagram appliance film + Linear’s motion discipline. No stock “AI purple gradient.”

---

## 3. Stack (do not wander)

| Layer | Choice |
|---|---|
| Frontend | Next.js App Router (latest stable), TypeScript, Tailwind, Framer Motion |
| Backend | FastAPI + pydantic v2 + scikit-learn + joblib + numpy |
| Data | `data/recipes.json` (array of Recipe) generated at build from the R&D dumps or a committed seed of ≥ 500 recipes |
| Index | `data/tfidf.joblib` fitted at first boot, reused |
| Deploy | Frontend → Vercel. API → Railway or Render. `NEXT_PUBLIC_API_URL` for the client |
| Auth | None in v1 |
| Package manager | pnpm on web, uv or pip on API |

Monorepo:

```
kitchen/
  apps/web/          # Next.js
  apps/api/          # FastAPI
  data/recipes.json
  data/tfidf.joblib  # built on boot if missing
  README.md
```

---

## 4. Recipe record (normalize whatever the JSONs give you)

```ts
type Recipe = {
  id: string;
  title: string;
  ingredients: string[];      // raw lines or names
  instructions: string;       // joined steps
  tags: string[];             // cuisine, diet, time, meal
  source?: string;            // ar | epi | fn | user
};
```

If the AllRecipes / Epicurious / Food Network dumps use different keys (`title`, `ingredients`, `instructions`, `picture_link`, …), write a one-shot `scripts/ingest.py` that maps them into this shape and drops empties. Cap v1 at 2,000 recipes if the raw files are huge (~205 MB). Prefer diversity (Levantine, vegetarian, pantry-staple dishes) in the seed if you subsample.

---

## 5. Ranking — implement BOTH modes. Default = coverage.

The 2022 notebook answered “documents like this query.” The shipped cookOverflow product answered “what can I cook with this pantry.” The UI toggle on the risen search bar:

- **Use what I have** → `mode=coverage` (default)
- **Find similar recipes** → `mode=tfidf`

### 5.1 Shared text helpers (port from the notebook, fix the bugs)

```python
import re

STAPLES = {"salt", "water", "pepper", "oil", "sugar", "black pepper", "olive oil"}

def normalize(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", " ", s)
    s = re.sub(r"\s+", " ", s)
    # light singularization good enough for v1
    if s.endswith("oes"): s = s[:-2]          # tomatoes -> tomat (ok) — better: a small irregular map
    elif s.endswith("ies"): s = s[:-3] + "y"
    elif s.endswith("es") and not s.endswith("ses"): s = s[:-2]
    elif s.endswith("s") and not s.endswith("ss"): s = s[:-1]
    return s.strip()

IRREGULAR = {
    "tomatoes": "tomato", "potatoes": "potato", "leaves": "leaf",
    "chickpeas": "chickpea", "garbanzo beans": "chickpea", "garbanzo": "chickpea",
    "labneh": "labneh", "zaatar": "zaatar", "za'atar": "zaatar",
    "eggplants": "eggplant", "aubergine": "eggplant",
}

def canonical(s: str) -> str:
    s = normalize(s)
    return IRREGULAR.get(s, s)

def tokenize_query(q: str) -> list[str]:
    parts = re.split(r"[,\n]| and ", q.lower())
    out = []
    for p in parts:
        c = canonical(p)
        if c:
            out.append(c)
    # de-dupe, keep order
    seen, uniq = set(), []
    for x in out:
        if x not in seen:
            seen.add(x); uniq.append(x)
    return uniq
```

Word-boundary match (production bug to NOT repeat: `rice` must not match `licorice`):

```python
def matches(need: str, have: str) -> bool:
    n, h = canonical(need), canonical(have)
    if not n or not h:
        return False
    if n == h:
        return True
    return bool(re.search(rf"\b{re.escape(n)}\b", h) or re.search(rf"\b{re.escape(h)}\b", n))
```

### 5.2 Mode `coverage` — port of production `rank_recipes`

For each recipe:

- `need` = canonical ingredient names (strip quantities if the line has them: drop leading `½ cup`, `2 tbsp`, etc.)
- `have` = user pantry tokens
- A need item is **matched** if any have-token `matches()` it, OR the need item is in `STAPLES` (when `staples=1`, default on)
- `real_matches` = matched items that are NOT staples
- Drop the recipe if `real_matches == 0`
- `score = len(matched) / max(len(need), 1)`
- Sort by `score` desc, then fewer missing, then title
- Return top `k` (default 20) with `matched[]`, `missing[]`, `score`

This is the “I opened the fridge” algorithm. Explainable. Test it with `have = ["rice"]` and a recipe that contains `licorice` — it must NOT match.

### 5.3 Mode `tfidf` — port of notebook `Search_Recipes`

Fit once at API startup (or load `tfidf.joblib`):

```python
from sklearn.feature_extraction.text import TfidfVectorizer

def recipe_text(r) -> str:
    return " ".join([
        r["title"],
        " ".join(r["ingredients"]),
        r.get("instructions") or "",
        " ".join(r.get("tags") or []),
    ])

vectorizer = TfidfVectorizer(
    ngram_range=(1, 1),
    min_df=2,
    max_df=0.85,
    norm="l2",
    lowercase=True,
)
X = vectorizer.fit_transform([recipe_text(r) for r in recipes])  # CSR, L2 rows
```

Optional field-weighted variant if you have the memory (notebook weights):

- `title` weight 0.2, `body` (ingredients+instructions) 0.3, `tags` 0.5
- Fit three vectorizers that share the same vocabulary (`vectorizer.build_analyzer()` + a shared vocab) OR concatenate with repeated tokens (`title` × 2, `tags` × 5) as a cheaper approximation. Document which you chose.

Query:

- Join pantry tokens + intent tags into one string (e.g. `"labneh tomato pita Levantine 30-min"`)
- `q = vectorizer.transform([query])`
- scores = `X @ q.T`  → toarray().ravel()   # cosine, because rows are L2
- Optional notebook `qweight_array`: if the user typed an ordered list of 3+ tokens, weight the first token higher by transforming tokens separately and doing `0.5*s1 + 0.25*s2 + 0.25*s3`. Nice-to-have, not blocker.
- Return top `k` with score. Also compute `matched[]` / `missing[]` with the coverage helpers so cards stay honest.

Do **not** port NMF-50 or TextRank in v1. Leave `TODO` hooks:

```python
# Future: NMF(n_components=50, init="nndsvdar") for cuisine facets
# Future: TextRank keywords — if ported, POS test MUST be
#         word.pos_ in {"NOUN", "ADJ", "VERB"}
#         (the notebook used `('NOUN' or 'ADJ' or 'VERB')` which is a bug)
```

### 5.4 Intent tags as filters, not prompt spice

Tags the user toggles (`Levantine`, `vegan`, `30-min`, `order-in`) filter the candidate set **before** scoring when a recipe has tags. If a recipe has no tags, keep it (don’t over-filter a messy scrape). `order-in` is a UI flag that *also* surfaces the shop list even when missing is empty (restaurants / delivery stub). Do not invent restaurant rankings.

---

## 6. API contract

Base: `http://localhost:8000`

### `GET /health`
`{ "ok": true, "recipes": 1842, "index": "tfidf-l2" }`

### `GET /api/ingredients?q=`
Autocomplete against the vocabulary of canonical ingredient names extracted from the corpus. Substring + popularity (how many recipes contain it). Limit 12. This is the chip typeahead.

### `POST /api/cook`
```json
{
  "ingredients": ["labneh", "tomato", "pita", "egg"],
  "tags": ["Levantine", "30-min"],
  "mode": "coverage",
  "staples": true,
  "k": 20
}
```
Response:
```json
{
  "query": ["labneh", "tomato", "pita", "egg"],
  "mode": "coverage",
  "results": [
    {
      "id": "epi-2217",
      "title": "Shakshuka with pita",
      "score": 0.83,
      "matched": ["tomato", "egg", "pita"],
      "missing": ["cumin", "chili"],
      "tags": ["Levantine", "breakfast"],
      "ingredients": ["..."],
      "instructions": "..."
    }
  ]
}
```

### `POST /api/scan`  — FROZEN for the local VLM
Request: `multipart/form-data` field `files` (1–3 images) **or** JSON `{ "fixture": true }`.

v1 implementation:
- If `fixture=true` or `?demo=1`, return a canned pantry so the fridge demo works without a model.
- Else return `501` with body:

```json
{
  "image_ok": false,
  "warnings": ["local VLM not connected"],
  "proposed": [],
  "needs_confirm": [],
  "rejected": []
}
```

When the user later runs a local VLM, it MUST fill this shape and nothing else:

```json
{
  "image_ok": true,
  "warnings": [],
  "proposed": [
    { "name": "labneh", "state": "packaged", "confidence": "high" },
    { "name": "tomato", "state": "raw", "confidence": "high" }
  ],
  "needs_confirm": [
    { "name": "pita", "state": "unknown", "confidence": "low" }
  ],
  "rejected": []
}
```

Implement the extractor as a protocol so v2 is a file swap, not a rewrite:

```python
from typing import Protocol

class IngredientExtractor(Protocol):
    def extract(self, images: list[bytes]) -> dict: ...

class FixtureExtractor:
    def extract(self, images):
        return {"image_ok": True, "proposed": [
            {"name": "labneh", "state": "packaged", "confidence": "high"},
            {"name": "tomato", "state": "raw", "confidence": "high"},
            {"name": "pita", "state": "unknown", "confidence": "low"},
            {"name": "egg", "state": "raw", "confidence": "high"},
        ], "needs_confirm": [], "warnings": ["fixture extractor"]}

class LocalVLMExtractor:
    """POST {LOCAL_VLM_URL}/extract with the same JSON shape. OpenAI-compat
    localhost (e.g. http://127.0.0.1:8080/v1) is also fine — wrap it here."""
    def extract(self, images):
        ...

# Choose: LOCAL_VLM_URL set → LocalVLMExtractor; else FixtureExtractor on
# ?demo=1 / fixture=true; else 501 empty contract.
```

Rules the future adapter must obey (write them in a comment in `apps/api/scan.py`):

- Names only. No grams, no calories, no generated recipe.
- Omit if unsure → `needs_confirm` or omit.
- No containers, brands, shelves.
- Canonicalize through `canonical()` before responding.
- Pixels stay on localhost. Do not upload to Gemini Files API.
- After the call, the frontend **only** merges `proposed` into chips (high) and marks `needs_confirm` chips as dashed / amber. User edits. Then `POST /api/cook` as if they typed.

### `GET /api/recipes/{id}`
Full recipe for the card expand / Cook view.

CORS: allow the Vercel origin and `http://localhost:3000`.

---

## 7. Frontend architecture

`apps/web/app/page.tsx` — the kitchen.

Components:

- `KitchenScene` — background + lighting
- `Refrigerator` — closed/open, handle button, decorative inner shelves
- `DoorSearch` — the risen bar + chip input + mode toggle + tag pills
- `ChipInput` — typeahead via `GET /api/ingredients`
- `CrisperCamera` — photo + camera `<input accept="image/*" capture="environment">` wired to `/api/scan` (fixture in v1)
- `CounterResults` — card grid
- `RecipeCard` — used vs missing, coverage bar, Cook / Shop missing
- `ShopTape` — missing list + Uber Eats / Instacart / copy
- `ModeToggle` — “Use what I have” | “Find similar”

State (URL-serializable so a pantry is shareable):

```
/?have=labneh,tomato,pita&want=Levantine,30-min&mode=coverage
```

Hydrate chips from the query string on load. Updating chips writes the URL.

Do **not** persist photos. Object URLs are revoked after scan.

---

## 8. Tests the agent must write and run

API (`apps/api/tests/test_rankers.py`):

1. `normalize` is idempotent on `"Tomato"`.
2. `matches("rice", "licorice") is False`.
3. `matches("chickpea", "canned chickpeas") is True`.
4. Coverage: pantry `{egg, tomato}` ranks a shakshuka-like fixture above a chocolate-cake fixture.
5. Coverage drops a recipe with zero real (non-staple) matches.
6. TF-IDF: query `"chicken lemon garlic"` returns the fixture recipe whose text contains those words in the top 5.
7. `/api/scan` without fixture returns 501 or the empty contract; with fixture returns proposed names that then flow through `canonical()`.

Web: Playwright smoke — open door, type `egg, tomato`, see at least one card.

---

## 9. README the agent must write

- How to ingest the R&D JSONs (`python scripts/ingest.py path/to/json`)
- How to run API + web locally
- How to deploy (Vercel project + Railway service + env)
- How to plug a local VLM later (implement `apps/api/scan.py` against the frozen contract; keep pixels on disk-tmp and delete)
- Honest paragraph: TF-IDF finds *similar writeups*; coverage answers *what can I cook*. Default is coverage because that is the fridge question.
- Link back to `cookOverflowDroobi/Core` R&D folder as the research origin.

---

## 10. Build order (do this in order, commit as you go)

1. Ingest script + `data/recipes.json` (≥ 500 rows).
2. FastAPI: normalize / matches / coverage / tfidf fit / `/api/cook` / `/api/ingredients` / `/api/scan` stub.
3. Tests in §8, all green.
4. Next.js kitchen scene S0–S3 (door + risen bar + chips) with mock results.
5. Wire chips → `/api/cook` → cards (S5).
6. Missing list + Uber Eats / Instacart stubs (S6).
7. Scan fixture button on the crisper (S7).
8. URL state, mobile layout, reduce-motion.
9. Deploy. Paste live URLs in the README.

---

## 11. Acceptance checklist

- [ ] Opening the fridge is the only onboarding.
- [ ] I can type `labneh, tomato, pita, egg`, hit Enter, and see ranked recipes from OUR corpus in < 400ms after the API is warm.
- [ ] I can toggle TF-IDF vs coverage and the order changes.
- [ ] A recipe never ranks as cookable on a substring accident (`rice` / `licorice`).
- [ ] Missing ingredients become a shop tape with an Uber Eats search URL.
- [ ] Photo button does not call a cloud VLM.
- [ ] No “as an AI chef I recommend…” copy anywhere in the running app.
- [ ] Page feels like a kitchen in 2030, not a dashboard from 2016.
- [ ] README explains how the notebook became this service.

---

## 12. If the R&D JSONs are missing

Build a committed `data/seed.json` of ~80 hand-written recipes heavy on Levantine / pantry cooking (shakshuka, fatteh, mujaddara, roast chicken, tomato eggs, hummus bowls, pasta aglio e olio, fried rice, dal, grilled halloumi, etc.) so the product runs. Keep the ingest script ready for the real dumps.

---

Start by scaffolding the monorepo and the ingest script. Do not write a marketing landing page. The kitchen *is* the product.
