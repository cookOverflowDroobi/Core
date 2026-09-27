"""Fridge scan: photos in, a proposed ingredient list out, for the user to confirm before cooking.

The vision model only reads the photos. Its names go through normalize() like anything typed, and
ranking stays in rank_recipes(): the model never picks or writes recipes.
"""
import base64
import io
import json
import math
import urllib.error
import urllib.request

from django.conf import settings
from PIL import Image, ImageOps

from .ingredients import PANTRY_STAPLES, normalize

MAX_IMAGES = 3
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
LONG_EDGE = 1280
CONFIRM_BELOW = 0.7  # items the model is less sure of start unticked in the review list
STATES = {"raw", "cooked", "leftover", "packaged", "unknown"}
SOURCES = {"visible", "label", "inferred"}
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

PROMPT = """You extract cookable ingredients from refrigerator and pantry photos.

Rules:
- List only edible ingredients a cook would put in a recipe.
- Ignore shelves, containers, brands, logos, magnets and non-food products.
- If a label is readable, use the food name, not the brand ("Almarai labneh" -> labneh).
- Prefer plain grocery names: "tomato", not "grape tomatoes on the vine".
- state is one of: raw, cooked, leftover, packaged, unknown.
- evidence is one of: visible (you can see the food), label (you read it on packaging),
  inferred (you are guessing from shape or context).
- confidence is a number from 0 to 1.
- If you cannot see an item clearly, leave it out. Do not guess.
- Pantry staples (salt, water, black pepper, oil, sugar) are assumed; do not list them.
- The photos may show different parts of one kitchen. List each ingredient once.
- Put anything that limited what you could see (dark, blurry, blocked shelves) in warnings."""

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "ingredients": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING"},
                    "state": {"type": "STRING"},
                    "confidence": {"type": "NUMBER"},
                    "evidence": {"type": "STRING"},
                },
                "required": ["name", "state", "confidence", "evidence"],
            },
        },
        "warnings": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["ingredients", "warnings"],
}


class ScanError(Exception):
    """The vision model couldn't be reached or gave no usable answer."""


def enabled():
    return bool(settings.COOK_SCAN_API_KEY)


def prepare(upload):
    """Photo -> JPEG bytes for the model: upright, long edge at most 1280 px and no metadata, so a
    phone's GPS position never leaves the server. Raises ValueError for anything that isn't a photo."""
    try:
        with Image.open(upload) as image:
            image.draft("RGB", (LONG_EDGE, LONG_EDGE))  # decode big JPEGs at a reduced size
            image = ImageOps.exif_transpose(image)
            image.thumbnail((LONG_EDGE, LONG_EDGE))
            buffer = io.BytesIO()
            image.convert("RGB").save(buffer, format="JPEG", quality=80)
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise ValueError(f"{getattr(upload, 'name', 'That file')} couldn't be read as a photo.") from error
    return buffer.getvalue()


def extract(photos):
    """Ask the vision model what's in the photos. Returns its JSON: {"ingredients": [...], "warnings": [...]}."""
    parts = [{"text": PROMPT}]
    for number, photo in enumerate(photos, 1):
        parts.append({"text": f"Photo {number}:"})
        parts.append({"inlineData": {"mimeType": "image/jpeg", "data": base64.b64encode(photo).decode()}})
    body = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "responseSchema": SCHEMA},
    }
    request = urllib.request.Request(
        ENDPOINT.format(model=settings.COOK_SCAN_MODEL), data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "x-goog-api-key": settings.COOK_SCAN_API_KEY},
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.COOK_SCAN_TIMEOUT) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        raise ScanError(f"HTTP {error.code}: {error.read()[:300]!r}") from error
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        raise ScanError(f"unreachable: {error}") from error
    try:
        return json.loads(payload["candidates"][0]["content"]["parts"][0]["text"])
    except (KeyError, IndexError, TypeError, ValueError) as error:
        blocked = (payload.get("promptFeedback") or {}).get("blockReason") if isinstance(payload, dict) else None
        raise ScanError(f"no usable answer ({blocked or 'empty response'})") from error


def propose(extracted):
    """Model output -> {proposed, rejected, warnings}. Names are normalised, staples and repeats set
    aside, and anything the model wasn't sure of is marked for the user to confirm."""
    extracted = extracted if isinstance(extracted, dict) else {}
    items = extracted.get("ingredients")
    proposed, rejected, seen = [], [], set()
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        raw = str(item.get("name") or "").strip()[:100]
        name = normalize(raw)
        if not name:
            continue
        if name in PANTRY_STAPLES or name in seen:
            rejected.append({"raw": raw, "reason": "staple" if name in PANTRY_STAPLES else "duplicate"})
            continue
        seen.add(name)
        try:
            confidence = min(max(float(item.get("confidence")), 0.0), 1.0)
        except (TypeError, ValueError):
            confidence = 0.0
        if not math.isfinite(confidence):
            confidence = 0.0
        source = item.get("evidence") if item.get("evidence") in SOURCES else "inferred"
        proposed.append({
            "raw": raw,
            "name": name,
            "confidence": round(confidence, 2),
            "state": item.get("state") if item.get("state") in STATES else "unknown",
            "source": source,
            "needs_confirm": confidence < CONFIRM_BELOW or source == "inferred",
        })
    proposed.sort(key=lambda p: (p["needs_confirm"], -p["confidence"]))
    warnings = extracted.get("warnings")
    warnings = [str(w).strip()[:200] for w in warnings if str(w).strip()] if isinstance(warnings, list) else []
    return {"proposed": proposed[:30], "rejected": rejected, "warnings": warnings[:5]}
