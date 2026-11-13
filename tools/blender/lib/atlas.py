"""
Packs the pictures of a figure into one large picture, an atlas, and writes
the file that tells the game where each picture is.

The file follows the "JSON Hash" layout that Phaser reads. Empty space around
each picture is trimmed away. The mask atlas uses exactly the same layout as
the base atlas, so one file describes both.
"""

import json
from pathlib import Path

import numpy as np

from . import export

PADDING = 2  # empty pixels between pictures, so that neighbours never bleed into each other


def trim_box(pixels: np.ndarray) -> tuple[int, int, int, int]:
    """The smallest box (left, top, width, height) that holds everything visible."""
    visible = pixels[..., 3] > 1 / 255
    rows = np.flatnonzero(visible.any(axis=1))
    columns = np.flatnonzero(visible.any(axis=0))
    if rows.size == 0:
        return 0, 0, 1, 1
    left, top = int(columns[0]), int(rows[0])
    return left, top, int(columns[-1]) - left + 1, int(rows[-1]) - top + 1


def pack(sizes: list[tuple[int, int]], width: int) -> tuple[list[tuple[int, int]], int]:
    """Places boxes in rows, tallest first. Returns each box's corner, in the order given, and the height used."""
    order = sorted(range(len(sizes)), key=lambda i: (-sizes[i][1], -sizes[i][0], i))
    places: list[tuple[int, int]] = [(0, 0)] * len(sizes)
    x = y = PADDING
    row_height = 0
    for i in order:
        w, h = sizes[i]
        if x + w + PADDING > width:
            x = PADDING
            y += row_height + PADDING
            row_height = 0
        places[i] = (x, y)
        x += w + PADDING
        row_height = max(row_height, h)
    return places, y + row_height + PADDING


def write_atlas(
    out: Path,
    name: str,
    frames: list[tuple[str, np.ndarray, np.ndarray]],
    anchor: tuple[float, float],
    meta: dict,
    max_size: int = 4096,
) -> dict:
    """
    Writes <name>.png, <name>_mask.png and <name>.json to `out`.
    `frames` holds (frame name, base picture, mask picture). `anchor` is the
    point of every untrimmed picture that stands on the unit's place in the
    game, as shares of its width and height.
    """
    out.mkdir(parents=True, exist_ok=True)
    boxes = [trim_box(base) for _, base, _ in frames]
    sizes = [(w, h) for _, _, w, h in boxes]

    # The narrowest power of two that keeps the atlas no taller than it is wide.
    width = 256
    while True:
        places, height = pack(sizes, width)
        if height <= width or width >= max_size:
            break
        width *= 2
    if height > max_size:
        raise SystemExit(f"The atlas for {name} does not fit in {max_size} x {max_size} pixels")

    base_atlas = np.zeros((height, width, 4), dtype=np.float32)
    mask_atlas = np.zeros((height, width, 4), dtype=np.float32)
    described = {}
    for (frame_name, base, mask), (left, top, w, h), (x, y) in zip(frames, boxes, places):
        base_atlas[y : y + h, x : x + w] = base[top : top + h, left : left + w]
        mask_atlas[y : y + h, x : x + w] = mask[top : top + h, left : left + w]
        full_h, full_w = base.shape[:2]
        described[frame_name] = {
            "frame": {"x": x, "y": y, "w": w, "h": h},
            "rotated": False,
            "trimmed": True,
            "spriteSourceSize": {"x": left, "y": top, "w": w, "h": h},
            "sourceSize": {"w": full_w, "h": full_h},
            "anchor": {"x": anchor[0], "y": anchor[1]},
        }

    export.write_png(out / f"{name}.png", base_atlas)
    export.write_png(out / f"{name}_mask.png", mask_atlas)
    document = {
        "frames": described,
        "meta": {
            "app": "animalplanet tools/blender",
            "image": f"{name}.png",
            "mask": f"{name}_mask.png",
            "format": "RGBA8888",
            "size": {"w": width, "h": height},
            **meta,
        },
    }
    (out / f"{name}.json").write_text(json.dumps(document, indent=1) + "\n", encoding="utf-8")
    return document
