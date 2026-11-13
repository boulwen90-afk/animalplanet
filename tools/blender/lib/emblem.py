"""
Sigils: one bold animal head per race, shown on shields and capes.

A sigil is a stack of flat shapes read from emblems/<name>.toml. It is laid
onto a surface by a `place` function, so the same sigil fits a flat shield and
a curved cape. Shapes in the "field" colour use the team-colour material, so
they follow the player's colour.
"""

from typing import Callable

import bmesh
import numpy as np
from mathutils import Vector

from .config import ROOT, _load
from .materials import Palette
from .mesh import Builder

Point = tuple[float, float]
# Turns a point of the sigil (x, y in -1..1) and a height above the surface into a place in the scene.
Place = Callable[[float, float, float], Vector]


def load_emblem(name: str) -> dict:
    return _load(ROOT / "emblems" / f"{name}.toml")


def polygons(layer: dict) -> list[list[Point]]:
    """The outlines a layer stands for, with the mirror images filled in."""
    if "half" in layer:
        right = [tuple(point) for point in layer["half"]]
        left = [(-x, y) for x, y in reversed(right) if abs(x) > 1e-9]
        return [right + left]
    if "pair" in layer:
        right = [tuple(point) for point in layer["pair"]]
        return [right, [(-x, y) for x, y in reversed(right)]]
    return [[tuple(point) for point in layer["shape"]]]


def layers(emblem: dict) -> list[tuple[str, int, list[Point]]]:
    """Every outline as (colour, level, points); higher levels lie on top of lower ones."""
    result = []
    for layer in emblem["layer"]:
        if layer["color"] == "field":
            level = 1
        else:
            level = 2 if layer.get("raised") else 0
        for outline in polygons(layer):
            result.append((layer["color"], level, outline))
    return result


def build_emblem(
    b: Builder, name: str, emblem: dict, place: Place, pal: Palette, lift: float = 0.012
) -> None:
    """Lays a sigil onto a surface, as thin shapes stacked just above it."""
    for i, (color, level, outline) in enumerate(layers(emblem)):
        bm = bmesh.new()
        face = bm.faces.new([bm.verts.new((x, y, 0.0)) for x, y in outline])
        # Cut the shape into small triangles so it can follow a curved surface.
        triangles = bmesh.ops.triangulate(bm, faces=[face], ngon_method="EAR_CLIP")
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
        del triangles
        height = lift * (level + 1)
        for vert in bm.verts:
            vert.co = place(vert.co.x, vert.co.y, height)
        material = pal["team"] if color == "field" else pal["emblem"]
        b._finish(f"{name}_{i}", bm, material)


def rasterize(emblem: dict, size: int, field: str, charge: str, rim: str) -> np.ndarray:
    """A flat picture of the sigil on a round field, for looking at the design on its own."""
    from .export import hex_to_rgb

    fine = 3
    n = size * fine
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    # The disc fills the picture; the sigil sits inside it with a margin.
    x = (xs + 0.5) / n * 2 - 1
    y = 1 - (ys + 0.5) / n * 2
    radius = np.hypot(x, y)
    image = np.zeros((n, n, 4), dtype=np.float32)
    image[radius <= 0.98, :3] = hex_to_rgb(rim)
    image[radius <= 0.98, 3] = 1.0
    image[radius <= 0.86, :3] = hex_to_rgb(field)

    scale = 0.62
    colors = {"field": hex_to_rgb(field), "charge": hex_to_rgb(charge)}
    for color, _, outline in sorted(layers(emblem), key=lambda item: item[1]):
        inside = np.zeros((n, n), dtype=bool)
        points = [(px * scale, py * scale) for px, py in outline]
        for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]):
            if y0 == y1:
                continue
            crosses = ((y0 > y) != (y1 > y)) & (x < (x1 - x0) * (y - y0) / (y1 - y0) + x0)
            inside ^= crosses
        image[inside, :3] = colors[color]
    return image.reshape(size, fine, size, fine, 4).mean(axis=(1, 3))
