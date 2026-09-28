"""Download a real, freely licensed photo of every demo dish from Wikimedia Commons.

    python manage.py fetch_demo_photos             # fetch the photos that are missing
    python manage.py fetch_demo_photos --refresh   # fetch them all again
    python manage.py fetch_demo_photos --only Suya --only Zarb

Only licenses that allow reuse and resizing with credit are accepted: public domain, CC0, CC BY and
CC BY-SA. Every photo's author, license and source page go to media/demo/photos/CREDITS.md.
seed_demo_data uses these photos when they exist and falls back to drawn placeholders.
"""
import html
import json
import re
import time
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from PIL import Image

from core.management.demo_content import DISHES

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "cookOverflow-demo/1.0 (https://github.com/cookOverflowDroobi/Core; demo seed photos)"
PHOTO_DIR = Path("demo", "photos")
MAX_WIDTH = 1280
LICENSES = re.compile(r"^(cc0|pd|pd-.*|public domain|cc-by-\d.*|cc-by-sa-\d.*)$", re.I)
# File names that usually mean a sign, a menu, a package or a street scene rather than the dish.
AVOID = re.compile(
    r"(menu|sign\b|logo|restaurant|shop|store|stall|street|market|\bmap\b|packag|\bbox\b|\bcan\b|drawing|"
    r"illustration|stamp|museum|poster|label|vendor|seller|advert|screenshot|diagram|\bfestival)",
    re.I,
)
# Searches to try per dish, in order. Dishes not listed search for their own name.
SEARCHES = {
    "Galayet Bandora": ["Galayet bandora", "Galaya tomato", "Tomato stew pan"],
    "Zarb": ["Zarb", "Bedouin zarb barbecue"],
    "Mutabbal": ["Mutabbal", "Moutabal", "Baba ghanoush"],
    "Hareeseh": ["Hareeseh", "Basbousa"],
    "Risotto ai Funghi": ["Mushroom risotto", "Risotto ai funghi"],
    "Chicken Katsu Curry": ["Katsu curry", "Katsukarē"],
    "Tortilla Espanola": ["Tortilla de patatas", "Spanish omelette"],
    "Churros con Chocolate": ["Churros con chocolate", "Churros chocolate"],
    "Puff-Puff": ["Puff-puff", "Puff puff Nigeria"],
    "Moi Moi": ["Moi moi", "Moin moin"],
    "Ta'ameya": ["Ta'ameya", "Egyptian falafel", "Falafel plate"],
    "Om Ali": ["Om Ali", "Umm Ali dessert"],
    "Texas Brisket": ["Smoked brisket", "Texas barbecue brisket"],
    "Mac and Cheese": ["Macaroni and cheese", "Mac and cheese"],
    "Buttermilk Pancakes": ["Buttermilk pancakes", "Pancakes stack"],
    "Crepes": ["Crêpes", "Crepes"],
}
# Exact files for dishes where the search picks badly (a Maltese valley for Maqluba, a 1935 court
# record for Zarb), chosen by eye from the candidates.
PINNED = {
    "Maqluba": "File:طبخة المقلوبة Maqluba (cropped).jpg",
    "Musakhan": "File:Mushakhan Dish.jpg",
    "Mutabbal": "File:Mutabbel.jpg",
    "Zarb": "File:PikiWiki Israel 16546 Barbecue.jpg",
    "Molokhia": "File:Molokheya hi res.JPG",
    "Ful Medames": "File:Foul Medamas.jpg",
    "Paella Valenciana": "File:01 Paella Valenciana original.jpg",
    "Tortilla Espanola": "File:Tortilla de Patatas (Corte transversal).jpg",
    "Mac and Cheese": "File:Baked macaroni and cheese 1.jpg",
    "Puff-Puff": "File:Puff-Puff 2.jpg",
}


def api(params):
    query = urllib.parse.urlencode({"format": "json", "formatversion": 2, **params})
    request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def plain(value):
    """Commons metadata is HTML: '<a href="...">Jane</a>' -> 'Jane'."""
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value or "")).split())


def candidates(search=None, title=None):
    params = {
        "action": "query",
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiextmetadatafilter": "License|LicenseShortName|LicenseUrl|Artist|Credit",
        "iiurlwidth": MAX_WIDTH,
    }
    if title:
        params["titles"] = title
    else:
        params.update(generator="search", gsrnamespace=6, gsrsearch=f"{search} filetype:bitmap", gsrlimit=25)
    pages = api(params).get("query", {}).get("pages", [])
    return sorted(pages, key=lambda page: page.get("index", 0))


def acceptable(page, pinned=False):
    info = (page.get("imageinfo") or [{}])[0]
    meta = info.get("extmetadata") or {}  # an empty list when a file has none
    license_code = meta.get("License", {}).get("value", "")
    if not LICENSES.match(license_code) or info.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
        return False
    if pinned:
        return True
    width, height = info.get("width", 0), info.get("height", 0)
    return width >= 900 and 1.15 <= width / max(height, 1) <= 2.1 and not AVOID.search(page["title"])


class Command(BaseCommand):
    help = "Download freely licensed dish photos from Wikimedia Commons for the demo data."

    def add_arguments(self, parser):
        parser.add_argument("--refresh", action="store_true", help="Fetch photos that already exist again.")
        parser.add_argument("--only", action="append", default=[], help="Only this dish (repeatable).")

    def handle(self, *args, refresh=False, only=(), **options):
        folder = Path(settings.MEDIA_ROOT) / PHOTO_DIR
        folder.mkdir(parents=True, exist_ok=True)
        credits_path = folder / "credits.json"
        credits = json.loads(credits_path.read_text(encoding="utf-8")) if credits_path.exists() else {}

        dishes = [dish[0] for group in DISHES.values() for dish in group]
        for name in dishes:
            slug = slugify(name)
            if (only and name not in only) or ((folder / f"{slug}.jpg").exists() and not refresh and not only):
                continue
            page = self.pick(name)
            if not page:
                self.stdout.write(self.style.WARNING(f"{name}: nothing suitable found"))
                continue
            info = page["imageinfo"][0]
            meta = info.get("extmetadata") or {}
            request = urllib.request.Request(info.get("thumburl") or info["url"], headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                image = Image.open(BytesIO(response.read())).convert("RGB")
            if image.width > MAX_WIDTH:
                image = image.resize((MAX_WIDTH, round(image.height * MAX_WIDTH / image.width)), Image.LANCZOS)
            image.save(folder / f"{slug}.jpg", quality=85, optimize=True)
            credits[slug] = {
                "dish": name,
                "file": page["title"],
                "source": info["descriptionurl"],
                "author": plain(meta.get("Artist", {}).get("value")) or plain(meta.get("Credit", {}).get("value")) or "Unknown",
                "license": meta.get("LicenseShortName", {}).get("value", ""),
                "license_url": meta.get("LicenseUrl", {}).get("value", ""),
            }
            self.stdout.write(f"{name}: {page['title']} ({credits[slug]['license']})")
            time.sleep(0.5)  # be gentle with the API

        credits_path.write_text(json.dumps(credits, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        self.write_credits(folder / "CREDITS.md", credits)
        self.stdout.write(self.style.SUCCESS(f"{len(credits)} photos credited in {PHOTO_DIR / 'CREDITS.md'}"))

    def pick(self, name):
        if name in PINNED:
            pages = candidates(title=PINNED[name])
            return next((page for page in pages if acceptable(page, pinned=True)), None)
        for search in SEARCHES.get(name, [name]):
            page = next((page for page in candidates(search) if acceptable(page)), None)
            time.sleep(0.3)
            if page:
                return page
        return None

    @staticmethod
    def write_credits(path, credits):
        lines = [
            "# Demo photo credits",
            "",
            "The dish photos used by `seed_demo_data` come from Wikimedia Commons under the licenses below.",
            "They were resized to at most 1280 px wide. Profile covers are cropped from these photos.",
            "",
            "| Photo | Dish | Author | License | Source |",
            "| --- | --- | --- | --- | --- |",
        ]
        for slug, credit in sorted(credits.items(), key=lambda item: item[1]["dish"]):
            license_text = credit["license"]
            if credit["license_url"]:
                license_text = f"[{license_text}]({credit['license_url']})"
            author = credit["author"].replace("|", "/")
            lines.append(f"| `{slug}.jpg` | {credit['dish']} | {author} | {license_text} | "
                         f"[{credit['file']}]({credit['source']}) |")
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
