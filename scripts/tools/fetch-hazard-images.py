"""Download a small square thumbnail for every environmental hazard (Helldivers Wiki).

Reads db/source/planet_korean.json (hazard id -> wiki page) and db/source/wiki_planets.json
(hazardPages, from scripts/fetch-planet-pages.mjs): the picture is the `image` of each page's
{{Infobox Hazard}}. Each one is cut to a centred square (a tall picture is fitted whole on the card's
dark background instead, so a barrel is not cut in half), resized to SIZE and saved as WebP
(dist/assets/hazards/<id>.webp, at most MAX_BYTES each). Writes dist/data/hazard-images.js
(hazard id -> src/size/sha256/source). Helpers are shared with fetch-warbond-item-images.py.
Images: Helldivers Wiki, CC BY-NC-SA 4.0.
Usage: python3 scripts/tools/fetch-hazard-images.py   (requires curl and Pillow with WebP)
"""

import hashlib, importlib.util, io, json, pathlib, re, subprocess, time

root = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "warbond_images", root / "scripts" / "tools" / "fetch-warbond-item-images.py"
)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)

from PIL import Image

_get = shared.get


def patient_get(url, tries=6):
    """wiki.gg answers 429 when asked too fast; wait and try again instead of failing the run."""
    for attempt in range(tries):
        try:
            return _get(url)
        except subprocess.CalledProcessError:
            if attempt == tries - 1:
                raise
            time.sleep(20 * (attempt + 1))


shared.get = (
    patient_get  # image_info() in the shared module looks `get` up at call time
)

SIZE = 128  # 2x the 64 px card icon
QUALITY = 70
MAX_BYTES = 12_000
BACKGROUND = (20, 23, 20)  # the card icon's #141714
TALL = 0.8  # width / height below this is fitted whole instead of cropped
out_dir = root / "dist" / "assets" / "hazards"
module_path = root / "dist" / "data" / "hazard-images.js"


def thumbnail(raw):
    with Image.open(io.BytesIO(raw)) as image:
        image = image.convert("RGBA")
        if image.width / image.height < TALL:
            image.thumbnail((SIZE, SIZE), Image.LANCZOS)
            canvas = Image.new("RGBA", (SIZE, SIZE), BACKGROUND + (255,))
            canvas.alpha_composite(
                image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2)
            )
            image = canvas
        else:
            side = min(image.width, image.height)
            left, top = (image.width - side) // 2, (image.height - side) // 2
            image = image.crop((left, top, left + side, top + side)).resize(
                (SIZE, SIZE), Image.LANCZOS
            )
        flat = Image.new("RGB", image.size, BACKGROUND)
        flat.paste(image, mask=image.getchannel("A"))
        for quality in range(QUALITY, 30, -6):
            buffer = io.BytesIO()
            flat.save(buffer, "WEBP", quality=quality, method=6)
            if buffer.tell() <= MAX_BYTES:
                return buffer.getvalue()
        raise ValueError(f"WebP exceeds {MAX_BYTES:,} bytes")


def main():
    text = json.loads(
        (root / "db" / "source" / "planet_korean.json").read_text(encoding="utf-8")
    )
    pages = json.loads(
        (root / "db" / "source" / "wiki_planets.json").read_text(encoding="utf-8")
    ).get("hazardPages", {})
    wanted = {}
    for hazard in text.get("hazards", []):
        page = pages.get(hazard["page"])
        match = page and re.search(r"\|\s*image\s*=\s*([^\n|]+)", page["text"])
        if match:
            wanted[hazard["id"]] = match.group(1).strip().replace("_", " ")
        else:
            print(f"  no infobox image: {hazard['id']} ({hazard['page']})")
    meta = shared.image_info(list(wanted.values()), 480)
    out_dir.mkdir(parents=True, exist_ok=True)
    entries, failed = {}, []
    for hazard_id, name in sorted(wanted.items()):
        m = meta.get(name)
        try:
            if not m:
                raise ValueError("not on the wiki")
            data = thumbnail(shared.get(m.get("thumburl") or m["url"]))
        except Exception as error:  # the card shows no picture
            print(f"  failed: {hazard_id} ({name}): {error}")
            failed.append(hazard_id)
            continue
        target = out_dir / f"{hazard_id}.webp"
        target.write_bytes(data)
        entries[hazard_id] = {
            "src": f"./assets/hazards/{target.name}",
            "width": SIZE,
            "height": SIZE,
            "file": m.get("wikiTitle", name),
            "sha256": hashlib.sha256(data).hexdigest(),
            "source": shared.source_url(m.get("wikiTitle", name)),
        }
        time.sleep(2)
    for stale in out_dir.iterdir():
        if stale.is_file() and stale.name not in {
            pathlib.Path(e["src"]).name for e in entries.values()
        }:
            stale.unlink()
    body = ",\n".join(
        f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}"
        for k, v in sorted(entries.items())
    )
    module_path.write_text(
        "// Generated by scripts/tools/fetch-hazard-images.py from the hazard pictures on Helldivers Wiki\n"
        "// (CC BY-NC-SA 4.0): square 128 x 128 WebP. Key: hazard id. Do not edit by hand.\n"
        f"export const hazardImages = {{\n{body}\n}};\n",
        encoding="utf-8",
        newline="\n",
    )
    total = sum(
        (out_dir / pathlib.Path(e["src"]).name).stat().st_size for e in entries.values()
    )
    print(
        f"{len(entries)} hazard thumbnails, {total:,} bytes; failed: {failed or 'none'}"
    )


if __name__ == "__main__":
    main()
