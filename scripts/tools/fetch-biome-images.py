"""Download a small landscape thumbnail for every biome (Helldivers Wiki).

Reads db/source/wiki_planets.json (run scripts/fetch-planet-pages.mjs first): every biome carries
the `landscape` file name from its {{Infobox Biome}}. Each image is taken as a wiki thumbnail,
cropped to 16:9 around the centre, resized to SIZE and saved as WebP (dist/assets/biomes/<id>.webp,
at most MAX_BYTES each). Writes dist/data/biome-images.js (biome id -> src/size/sha256/source).
Helpers (curl download, imageinfo) are shared with fetch-warbond-item-images.py.
Images: Helldivers Wiki, CC BY-NC-SA 4.0.
Usage: python3 scripts/tools/fetch-biome-images.py   (requires curl and Pillow with WebP)
"""

import hashlib, importlib.util, io, json, pathlib, re, sys, time

root = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "warbond_images", root / "scripts" / "tools" / "fetch-warbond-item-images.py"
)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)

from PIL import Image
import subprocess

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

SIZE = (320, 180)  # about 2x the card thumbnail
QUALITY = 62
MAX_BYTES = 24_000
out_dir = root / "dist" / "assets" / "biomes"
module_path = root / "dist" / "data" / "biome-images.js"


def slug(text):
    """Same as scripts/planet-parse.mjs slug(): the biome id used by dist/data/planets.js."""
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", text.lower()))


def thumbnail(raw):
    with Image.open(io.BytesIO(raw)) as image:
        image = image.convert("RGB")
        ratio = SIZE[0] / SIZE[1]
        if image.width / image.height > ratio:  # too wide: crop the sides
            width = round(image.height * ratio)
            left = (image.width - width) // 2
            image = image.crop((left, 0, left + width, image.height))
        else:  # too tall: crop top and bottom
            height = round(image.width / ratio)
            top = (image.height - height) // 2
            image = image.crop((0, top, image.width, top + height))
        image = image.resize(SIZE, Image.LANCZOS)
        for quality in range(QUALITY, 30, -6):
            buffer = io.BytesIO()
            image.save(buffer, "WEBP", quality=quality, method=6)
            if buffer.tell() <= MAX_BYTES:
                return buffer.getvalue()
        raise ValueError(f"WebP exceeds {MAX_BYTES:,} bytes")


def main():
    wiki = json.loads(
        (root / "db" / "source" / "wiki_planets.json").read_text(encoding="utf-8")
    )
    wanted = {
        slug(title): biome["landscape"]
        for title, biome in wiki["biomes"].items()
        if biome.get("landscape")
    }
    meta = shared.image_info(list(wanted.values()), 480)
    # A file name that the wiki redirects onto another biome's picture would show the wrong
    # biome (Volcanic Jungle's primordial_base image redirects to Deadlands'): leave it out.
    norm = lambda text: text.replace("_", " ").lower()
    owners = {}
    for biome_id, name in wanted.items():
        if meta.get(name):
            owners.setdefault(meta[name].get("wikiTitle", name), []).append(biome_id)
    borrowed = {
        biome_id
        for title, ids in owners.items()
        if len(ids) > 1
        for biome_id in ids
        if norm(wanted[biome_id]) != norm(title)
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    entries, failed = {}, []
    for biome_id, name in sorted(wanted.items()):
        m = meta.get(name)
        if biome_id in borrowed:
            print(
                f"  skipped: {biome_id} ({name} redirects to another biome's picture)"
            )
            continue
        try:
            if not m:
                raise ValueError("not on the wiki")
            data = thumbnail(shared.get(m.get("thumburl") or m["url"]))
        except Exception as error:  # the card shows no picture
            print(f"  failed: {biome_id} ({name}): {error}")
            failed.append(biome_id)
            continue
        target = out_dir / f"{biome_id}.webp"
        target.write_bytes(data)
        entries[biome_id] = {
            "src": f"./assets/biomes/{target.name}",
            "width": SIZE[0],
            "height": SIZE[1],
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
        "// Generated by scripts/tools/fetch-biome-images.py from the biome landscape images on Helldivers Wiki\n"
        "// (CC BY-NC-SA 4.0): cropped to 16:9, 320 x 180 WebP. Key: biome id. Do not edit by hand.\n"
        f"export const biomeImages = {{\n{body}\n}};\n",
        encoding="utf-8",
        newline="\n",
    )
    total = sum(
        (out_dir / pathlib.Path(e["src"]).name).stat().st_size for e in entries.values()
    )
    print(
        f"{len(entries)} biome thumbnails, {total:,} bytes; failed: {failed or 'none'}"
    )
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
