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
