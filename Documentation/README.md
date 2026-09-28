# The cookOverflow story

**From a 2022 search notebook to a kitchen that knows what you can cook, told in system-design diagrams.**

cookOverflow is one question asked three times. In 2022 a graduation project asked it as a text-search
problem: *which recipes are like these words?* In 2026 the app was rebuilt around a different framing:
*what can I actually cook with what I have?* A prototype, the 2030 Kitchen, then put both answers side by
side behind a fridge door. This document tells that story from A to Z, with the diagrams an engineer would
draw at each step, and it is precise about what was built, when, and by whom.

| System | What it is | When | Status |
| --- | --- | --- | --- |
| **R&D notebook** | TF-IDF, NMF topics and TextRank over 125,164 scraped recipes | 2022 | Offline research, never served |
| **cookOverflow Core** | Django + DRF API and React app: social recipes, "What can I cook?", For you, Trending | 2022 app, rebuilt Sep 2026 | This repository, runs locally, not deployed |
| **2030 Kitchen** | FastAPI + Next.js prototype serving coverage and TF-IDF over a 2,000-recipe slice of the 2022 corpus | Sep 2026 | Separate local repository, not deployed |

## Contents

- [A. The question (2022)](#a-the-question-2022)
- [B. The research pipeline](#b-the-research-pipeline)
- [C. What the research found](#c-what-the-research-found)

## The whole story on one line

```mermaid
timeline
    title cookOverflow, from commit history
    Jan 2022 : Repository created : accounts, email verification, profiles
    May 2022 : Recipe search notebook committed : TF-IDF, NMF, TextRank over 125k recipes
    Jun 2022 : Last team commit : social app with posts, likes, messages, notifications
    2023 to 2025 : No commits
    Sep 2026 : Repository cleaned and rebuilt : REST API, React app, coverage and social ranking
    Sep 2026 : Improvements branch : synonyms, fridge-photo scan, notebook bug fixes
    Sep 2026 : 2030 Kitchen prototype : both rankers side by side, local vision socket
```

---

## A. The question (2022)

cookOverflow started as a senior graduation project by Ahmad Droobi and Ataa Shaqour: a food social
network whose own data would answer one question, **"I have these ingredients, what should I cook?"**
The original use-case diagram ([`UMLs/Use_Case_Diagram.jpeg`](UMLs/Use_Case_Diagram.jpeg)) planned two
ways to ask it: typed text feeding "ML Model 1", and a photo feeding "ML Model 2".

```mermaid
flowchart LR
    user(("User"))
    admin(("Administrator"))
    subgraph app["Homemade Recipebowl (2022 plan)"]
        login["Login + verification"]
        input["Input"]
        text["Text"] --> m1["ML Model 1<br/>text to recipes"]
        image["Image"] --> m2["ML Model 2<br/>photo to recipes"]
        cuisine["Cuisine"] --> db[("Database")]
        rating["Recipe rating"]
        text --> input
        image --> input
        cuisine --> input
        rating --> input
    end
    user --> login
    user --> input
    admin --> m1
    admin --> m2
    admin --> db
```

The 2022 application itself was a classic server-rendered Django site. It still runs today under
`/legacy/`.

```mermaid
flowchart TB
    browser["Browser"] -->|"HTML forms"| django["Django 3.2 (MVT)"]
    subgraph django_apps["Django apps"]
        account["Account<br/>sign-up, email verification, login"]
        profile["Profile<br/>avatar, cover, followers"]
        timeline["Timeline<br/>posts, images, video, tags, likes, comments"]
        comms["communications<br/>direct messages"]
        notif["notifications"]
    end
    django --> django_apps
    django_apps --> templates["Django templates + static CSS/JS"]
    django_apps --> pg[("PostgreSQL")]
    templates --> browser
```

Model 1 was researched in a separate notebook. Model 2 was never built. Neither was wired into the site.

---

## B. The research pipeline

The research lives in [`AI_Search_RecommenderSystem_R&D/`](../AI_Search_RecommenderSystem_R%26D). Its real
control module is the 127-cell notebook `Recipe Recommendation System.ipynb`; `Recommendation_R&D.py` is an
incomplete extract of its cleaning stage. The corpus came from a third-party, MIT-licensed scraper
(`recipe-box-Scraper`, from github.com/rtlee9) run against three recipe sites.

```mermaid
flowchart TB
    subgraph acquire["1. Acquire"]
        ar["AllRecipes<br/>39,802 records"]
        epi["Epicurious<br/>25,323 records"]
        fn["Food Network<br/>60,039 records"]
    end
    ar --> json[("3 JSON dumps<br/>~207 MB, 125,164 recipes")]
    epi --> json
    fn --> json

    subgraph clean["2. Clean"]
        drop["drop nulls, punctuation-only rows,<br/>instructions under 20 chars"]
        strip["strip the scrape's 'ADVERTISEMENT' noise"]
        doc["document = title + ingredients + instructions"]
    end
    json --> drop --> strip --> doc

    subgraph nlp["3. Represent"]
        spacy["spaCy: lemmas, stop words<br/>(multiprocessed, checkpointed to CSV)"]
        tfidf["TF-IDF unigrams<br/>X is N x V, rows L2-normalised"]
    end
    doc --> spacy --> tfidf

    subgraph topics["4. Find structure"]
        lda["LDA, 50 topics<br/>discarded"]
        nmf["NMF, 50 topics, nndsvdar<br/>kept"]
        textrank["TextRank per topic:<br/>top 200 docs, window 4, PageRank<br/>25 keywords per topic"]
        tags["keywords stamped onto the<br/>top 2,000 docs per topic"]
    end
    tfidf --> lda
    tfidf --> nmf --> textrank --> tags

    subgraph rank["5. Rank"]
        search["Search_Recipes(query)<br/>weighted cosine over title, text, tags"]
        out["printed recipe list"]
    end
    tfidf --> search
    tags --> search
    search --> out
```

The ranking math, as implemented:

$$
\mathrm{tfidf}(t,d) = \mathrm{tf}(t,d)\cdot\left(\log\frac{1+n}{1+\mathrm{df}(t)}+1\right),
\qquad \lVert d \rVert_2 = 1
$$

$$
s(q,d) = 0.2\,\langle q, d_{\text{title}}\rangle + 0.3\,\langle q, d_{\text{text}}\rangle + 0.5\,\langle q, d_{\text{tags}}\rangle
$$

Because rows are L2-normalised, each inner product is a cosine similarity computed as a sparse dot product.
An optional ranked query (`qweight_array`) splits weight by halves so the first ingredient matters most:
for three ingredients the weights are 0.5, 0.25 and 0.25.

| Parameter | Value in the notebook |
| --- | --- |
| Topics (LDA and NMF) | `N_topics = 50` |
| Documents per topic for keyword extraction | `N_top_docs = 200` |
| Keywords per topic | `N_top_words = 25` |
| Documents tagged per topic | `N_docs_categorized = 2000` |
| TextRank co-occurrence window | `N_neighbor_window = 4` |
| Field weights | `w_title = 0.2`, `w_text = 0.3`, `w_categories = 0.5` |

---

## C. What the research found

The notebook is honest about its own results, and reading it closely surfaces more.

| Finding | Why it matters |
| --- | --- |
| Its conclusion: "the original text of the recipes returns better results than the categories generated with TextRank", yet categories carry 0.5 of the final score | The formula contradicts the experiment |
| Only the top 2,000 documents per topic get tags | Most recipes start with an empty tag field, the field weighted highest |
| NMF was chosen over LDA by reading topics, with no coherence metric, and K = 50 was never validated | A defensible call, but exploratory, not measured |
| LDA was fitted on TF-IDF values | LDA is a model of counts |
| `word.pos_ == ('NOUN' or 'ADJ' or 'VERB')` | The `or` chain evaluates to `'NOUN'`, so adjectives and verbs never reached TextRank |
| TextRank's adjacency is a dense V x V DataFrame filled cell by cell | Quadratic memory; a sparse co-occurrence matrix fits the job |
| `i[0] == np.nan` as the missing-ingredient check | NaN never equals anything, so the check found nothing |
| `nx.from_numpy_matrix` | Removed in NetworkX 3; the notebook no longer runs as written |
| With only the category weight on, `['apple', 'blueberry']` returns three glazed-carrot recipes | Similarity is not intent |
| `['japanese']` returns exactly the list an empty query returns (a crab bisque, a praline torte, artichokes) | A query that matches nothing still gets "results"; there is no no-match path |

The deepest finding is the pattern behind the last two rows. A similarity engine answers **"which
write-ups sound like this?"** That is not the question the project set out to answer.
