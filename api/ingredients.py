"""Ingredient normalisation and matching for "What can I cook?"."""
import re
from collections import Counter

# Things most kitchens already have. Optionally counted as available.
PANTRY_STAPLES = {"salt", "water", "black pepper", "olive oil", "oil", "sugar"}

_NON_WORD = re.compile(r"[^a-z\s'-]")
_SPACES = re.compile(r"\s+")
_IRREGULAR = {"leaves": "leaf", "loaves": "loaf", "halves": "half"}

# Other names for the same ingredient -> the name recipes here use. Only unambiguous pairs:
# bare "coriander" stays as it is, because it can mean the leaves or the seeds.
_SYNONYMS = {
    "garbanzo": "chickpea", "garbanzo beans": "chickpea", "chick peas": "chickpea",
    "scallions": "spring onion", "green onions": "spring onion",
    "aubergine": "eggplant", "courgette": "zucchini", "capsicum": "bell pepper",
    "fresh coriander": "cilantro", "coriander leaves": "cilantro", "rocket": "arugula",
    "prawns": "shrimp", "yoghurt": "yogurt", "minced beef": "ground beef", "beef mince": "ground beef",
    "double cream": "heavy cream", "icing sugar": "powdered sugar", "confectioners sugar": "powdered sugar",
    "cornflour": "cornstarch", "bicarbonate of soda": "baking soda", "bicarb": "baking soda",
    "plain flour": "all-purpose flour", "all purpose flour": "all-purpose flour",
    "chilli": "chili", "chillies": "chili", "chilies": "chili",
}


def _singular(word):
    if word in _IRREGULAR:
        return _IRREGULAR[word]
    if len(word) <= 3 or word.endswith(("ss", "us", "is")):
        return word
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith(("oes", "ches", "shes", "xes")):
        return word[:-2]
    if word.endswith("s"):
        return word[:-1]
    return word


def _clean(name):
    text = _SPACES.sub(" ", _NON_WORD.sub(" ", str(name).lower())).strip()
    return " ".join(_singular(word) for word in text.split())


# Keys go through the same cleaning as input, so "chillies" is stored as the "chilly" it becomes.
SYNONYMS = {_clean(other): name for other, name in _SYNONYMS.items()}
_SYNONYM_RE = re.compile(
    r"(?<![a-z])(" + "|".join(map(re.escape, sorted(SYNONYMS, key=len, reverse=True))) + r")(?![a-z])"
)


def normalize(name):
    """'Tomatoes ' -> 'tomato', 'Chickpeas' -> 'chickpea', 'Bay leaves' -> 'bay leaf',
    'Garbanzo beans' -> 'chickpea', 'Akkawi  Cheese' -> 'akkawi cheese'."""
    return _SYNONYM_RE.sub(lambda match: SYNONYMS[match.group(1)], _clean(name))


def _contains(haystack, needle):
    return re.search(rf"(?<![a-z]){re.escape(needle)}(?![a-z])", haystack) is not None


def matches(have, need):
    """True when an ingredient you have satisfies one a recipe needs (both normalised).

    'cheese' satisfies 'akkawi cheese', 'cheddar cheese' satisfies 'cheddar', but 'rice' never
    satisfies 'licorice'.
    """
    return have == need or _contains(need, have) or _contains(have, need)


def rank_recipes(have, posts, assume_staples=True):
    """Score recipe posts by how much of each recipe the given ingredients cover.

    Returns dicts sorted best first: {post, score, matched, missing}. Recipes with no real
    (non-staple) match are left out.
    """
    have = {normalize(item) for item in have if normalize(item)}
    results = []
    for post in posts:
        if not post.ingredients:
            continue
        matched, missing, real_matches = [], [], 0
        for original in post.ingredients:
            need = normalize(original)
            if any(matches(h, need) for h in have):
                matched.append(original)
                real_matches += 1
            elif assume_staples and need in PANTRY_STAPLES:
                matched.append(original)
            else:
                missing.append(original)
        if real_matches:
            results.append({
                "post": post,
                "score": len(matched) / len(post.ingredients),
                "matched": matched,
                "missing": missing,
            })
    results.sort(key=lambda r: (-r["score"], len(r["missing"]), -getattr(r["post"], "likes_count", 0)))
    return results


def vocabulary(ingredient_lists, query="", limit=20):
    """Most common ingredients across recipes, optionally filtered by a prefix/substring."""
    counts = Counter(normalize(item) for items in ingredient_lists for item in items)
    counts.pop("", None)
    query = normalize(query)
    names = [name for name, _ in counts.most_common() if not query or query in name]
    names.sort(key=lambda name: (not name.startswith(query), -counts[name]))
    return [{"name": name, "count": counts[name]} for name in names[:limit]]
