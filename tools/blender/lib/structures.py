"""
The parts buildings are made of. A building's config lists parts by type; each
function here builds one.

A building is described in its own frame, in tiles: the origin is the middle
of its footprint on the ground, x runs along the game's tile x axis (down to
the right on the screen), y runs up to the right, and z is up. The walls the
player sees are the ones facing -y (to the left) and +x (to the right).
"""

import math

from mathutils import Vector

from .emblem import build_emblem
from .materials import Palette
from .mesh import Builder, frame

UP = Vector((0.0, 0.0, 1.0))
# For each wall: the way it faces, and the direction along it that is to the right for someone facing it.
FACES = {
    "-y": (Vector((0.0, -1.0, 0.0)), Vector((1.0, 0.0, 0.0))),
    "+x": (Vector((1.0, 0.0, 0.0)), Vector((0.0, 1.0, 0.0))),
    "+y": (Vector((0.0, 1.0, 0.0)), Vector((-1.0, 0.0, 0.0))),
    "-x": (Vector((-1.0, 0.0, 0.0)), Vector((0.0, -1.0, 0.0))),
}


def on_face(face: str, wall: float, at: float, z: float, out: float = 0.0) -> Vector:
    """A point on a wall: `wall` is where the wall stands on its axis, `at` how far along it, `out` in front of it."""
    normal, along = FACES[face]
    origin = Vector((wall, 0.0, 0.0)) if face in ("+x", "-x") else Vector((0.0, wall, 0.0))
    side = at if face in ("-y", "+x") else -at
    return origin + along * side + UP * z + normal * out


def face_box(b: Builder, name: str, face: str, centre: Vector, width: float, depth: float, height: float, material):
    """A box lying against a wall: `width` along it, `depth` out from it."""
    size = (depth, width, height) if face in ("+x", "-x") else (width, depth, height)
    return b.box(name, centre, size, material)


def base(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A stone footing: a slab with a paler top course and heavier corner stones."""
    x0, y0, x1, y1 = p["box"]
    h = p["height"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    b.box(f"{name}.slab", (cx, cy, h * 0.42), (x1 - x0, y1 - y0, h * 0.84), pal["stone"])
    inset = 0.05
    b.box(f"{name}.top", (cx, cy, h * 0.92), (x1 - x0 - inset * 2, y1 - y0 - inset * 2, h * 0.16), pal["stone_light"])
    corner = p.get("corner", 0.16)
    for i, (x, y) in enumerate(((x0, y0), (x1, y0), (x1, y1), (x0, y1))):
        b.box(f"{name}.corner_{i}", (x, y, h * 0.5), (corner, corner, h), pal["stone_dark"])


def walls(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """Walls of stacked logs around a box, with the ends of the logs sticking out at the corners."""
    x0, y0, x1, y1 = p["box"]
    z0, z1 = p["z"]
    log = p.get("log", 0.13)
    r = log / 2
    b.box(
        f"{name}.core",
        ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
        (x1 - x0 - log * 0.6, y1 - y0 - log * 0.6, z1 - z0),
        pal["timber_dark"],
    )
    count = max(1, round((z1 - z0) / log))
    step = (z1 - z0) / count
    ends = p.get("ends", 0.07)
    for i in range(count):
        z = z0 + step * (i + 0.5)
        material = pal["timber"] if i % 2 == 0 else pal["timber_mid"]
        # Logs along x and along y alternate in height by half a log, as in a log cabin.
        for j, (start, end) in enumerate(
            (
                ((x0 - ends, y0 + r * 0.4, z), (x1 + ends, y0 + r * 0.4, z)),
                ((x0 - ends, y1 - r * 0.4, z), (x1 + ends, y1 - r * 0.4, z)),
                ((x0 + r * 0.4, y0 - ends, z), (x0 + r * 0.4, y1 + ends, z)),
                ((x1 - r * 0.4, y0 - ends, z), (x1 - r * 0.4, y1 + ends, z)),
            )
        ):
            b.limb(f"{name}.log_{i}_{j}", start, end, r * 1.08, r * 1.08, material, 6)


def frame_posts(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """The bare timber frame of a building being raised: posts, top beams and braces."""
    x0, y0, x1, y1 = p["box"]
    z0, z1 = p["z"]
    spacing = p.get("spacing", 0.8)
    t = p.get("thickness", 0.1)
    wood = pal["timber_new"]

    def posts_along(a, c, fixed, along_x: bool, tag: str):
        n = max(1, round((c - a) / spacing))
        for i in range(n + 1):
            u = a + (c - a) * i / n
            x, y = (u, fixed) if along_x else (fixed, u)
            b.box(f"{name}.post_{tag}_{i}", (x, y, (z0 + z1) / 2), (t, t, z1 - z0), wood)

    posts_along(x0, x1, y0, True, "a")
    posts_along(x0, x1, y1, True, "b")
    posts_along(y0, y1, x0, False, "c")
    posts_along(y0, y1, x1, False, "d")
    for i, (cx, cy, sx, sy) in enumerate(
        (
            ((x0 + x1) / 2, y0, x1 - x0 + t, t),
            ((x0 + x1) / 2, y1, x1 - x0 + t, t),
            (x0, (y0 + y1) / 2, t, y1 - y0 + t),
            (x1, (y0 + y1) / 2, t, y1 - y0 + t),
        )
    ):
        b.box(f"{name}.beam_{i}", (cx, cy, z1), (sx, sy, t), wood)
        b.box(f"{name}.rail_{i}", (cx, cy, z0 + (z1 - z0) * 0.5), (sx, sy, t * 0.7), wood)
    # A brace across each of the two walls the player sees.
    b.limb(f"{name}.brace_a", (x0, y0, z0), (x0 + (x1 - x0) * 0.45, y0, z1), t * 0.4, t * 0.4, wood, 4)
    b.limb(f"{name}.brace_b", (x1, y0, z0), (x1, y0 + (y1 - y0) * 0.45, z1), t * 0.4, t * 0.4, wood, 4)


def _roof_lines(p: dict):
    """Where a gable roof's ridge and eaves run: (ridge start, ridge end, across, half span)."""
    x0, y0, x1, y1 = p["box"]
    over = p.get("overhang", 0.12)
    if p.get("along", "x") == "x":
        start, end = Vector((x0 - over, (y0 + y1) / 2, 0)), Vector((x1 + over, (y0 + y1) / 2, 0))
        return start, end, Vector((0.0, 1.0, 0.0)), (y1 - y0) / 2 + over
    start, end = Vector(((x0 + x1) / 2, y0 - over, 0)), Vector(((x0 + x1) / 2, y1 + over, 0))
    return start, end, Vector((1.0, 0.0, 0.0)), (x1 - x0) / 2 + over


def gable_roof(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """
    A steep roof with two slopes of overlapping courses, a ridge cap, boards
    along the gables, the gable walls under them, and crossed finials.
    """
    start, end, across, half = _roof_lines(p)
    eave, ridge = p["eave"], p["ridge"]
    along = (end - start).normalized()
    length = (end - start).length
    middle = (start + end) / 2
    slope = math.hypot(half, ridge - eave)
    courses = p.get("courses", 5)
    thick = p.get("thickness", 0.06)
    for side, sign in (("a", 1.0), ("b", -1.0)):
        down = (across * sign * half + UP * (eave - ridge)).normalized()      # from the ridge to the eave
        normal = (across * sign * (ridge - eave) + UP * half).normalized()
        turn = frame(normal, tuple(along))
        for i in range(courses):
            t = (i + 0.5) / courses
            # Each course lies a little over the one below it.
            centre = middle + UP * ridge + down * slope * t + normal * (thick * 0.5 + 0.02 * (courses - i))
            material = pal["roof"] if i % 2 == 0 else pal["roof_dark"]
            b.box(f"{name}.course_{side}_{i}", centre, (length, slope / courses * 1.25, thick), material, turn)
        # Boards along the gable edges of the slope.
        for j, at in enumerate((start, end)):
            board = at + UP * ridge + down * slope * 0.5 + normal * (thick * 0.6)
            b.box(f"{name}.board_{side}_{j}", board, (0.08, slope * 1.04, thick * 2.2), pal["timber_dark"], turn)
    cap = pal[p.get("cap", "timber_dark")]
    b.limb(f"{name}.cap", start + UP * (ridge + 0.05), end + UP * (ridge + 0.05), 0.07, 0.07, cap, 6)

    # The gable walls: triangles of planks under each end of the roof.
    over = p.get("overhang", 0.12)
    for j, (at, out) in enumerate(((start, 1.0), (end, -1.0))):
        inner = at + along * out * over
        span = half - over
        left, right = inner - across * span + UP * eave, inner + across * span + UP * eave
        top = inner + UP * (eave + (ridge - eave) * span / half)
        b.sheet(f"{name}.gable_{j}", [[tuple(left), tuple(right)], [tuple(top), tuple(top)]], pal["timber_mid"])
        b.limb(f"{name}.gable_post_{j}", inner + UP * eave, top, 0.04, 0.04, pal["timber_dark"], 4)
    if p.get("finials", True):
        for j, at in enumerate((start, end)):
            peak = at + UP * ridge
            for k, sign in enumerate((1.0, -1.0)):
                b.limb(
                    f"{name}.finial_{j}_{k}",
                    peak - across * sign * 0.1 - UP * 0.08,
                    peak + across * sign * 0.2 + UP * 0.3,
                    0.035,
                    0.02,
                    pal["timber_dark"],
                    4,
                )


def rafters(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """The bare rafters of a roof that has not been covered yet."""
    start, end, across, half = _roof_lines(p)
    eave, ridge = p["eave"], p["ridge"]
    count = p.get("count", 6)
    wood = pal["timber_new"]
    for i in range(count):
        at = start.lerp(end, (i + 0.5) / count)
        for k, sign in enumerate((1.0, -1.0)):
            b.limb(f"{name}.rafter_{i}_{k}", at + across * sign * half + UP * eave, at + UP * ridge, 0.04, 0.04, wood, 4)
    b.limb(f"{name}.ridge", start + UP * ridge, end + UP * ridge, 0.05, 0.05, wood, 4)


def spire(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A pointed roof on a square tower, with a rim under it."""
    x, y = p["at"]
    half, z0, z1 = p["half"], p["z"][0], p["z"][1]
    b.box(f"{name}.rim", (x, y, z0), (half * 2.1, half * 2.1, 0.07), pal["timber_dark"])
    b.limb(f"{name}.roof", (x, y, z0), (x, y, z1), half * 1.5, 0.0, pal[p.get("material", "roof")], 4, 1.0, (1.0, 1.0, 0.0))
    b.limb(f"{name}.roof_low", (x, y, z0 - 0.02), (x, y, z0 + (z1 - z0) * 0.45), half * 1.62, half * 0.82, pal["roof_dark"], 4, 1.0, (1.0, 1.0, 0.0))


def door(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A plank door with iron bands in a heavy frame."""
    face, wall, at = p["face"], p["wall"], p["at"]
    z0, w, h = p.get("z", 0.0), p["width"], p["height"]
    face_box(b, f"{name}.leaf", face, on_face(face, wall, at, z0 + h / 2, 0.02), w, 0.06, h, pal["door"])
    for i, share in enumerate((0.28, 0.72)):
        face_box(b, f"{name}.band_{i}", face, on_face(face, wall, at, z0 + h * share, 0.05), w * 0.96, 0.03, h * 0.07, pal["iron"])
    for i, side in enumerate((-1.0, 1.0)):
        post = on_face(face, wall, at + side * (w / 2 + 0.05), z0 + h / 2 + 0.03, 0.04)
        face_box(b, f"{name}.post_{i}", face, post, 0.1, 0.1, h + 0.06, pal["timber_dark"])
    face_box(b, f"{name}.lintel", face, on_face(face, wall, at, z0 + h + 0.06, 0.05), w + 0.3, 0.12, 0.12, pal["timber_dark"])
    if p.get("split"):
        face_box(b, f"{name}.gap", face, on_face(face, wall, at, z0 + h / 2, 0.055), 0.03, 0.02, h, pal["timber_dark"])


def _sigil(b: Builder, pal: Palette, name: str, emblem, centre: Vector, right: Vector, up: Vector, normal: Vector, reach: float):
    if emblem:
        build_emblem(b, name, emblem, lambda x, y, h: centre + right * x * reach + up * y * reach + normal * h, pal)


def shield(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A round shield hung on a wall: iron rim, a field in the team colour and the race's sigil."""
    face = p["face"]
    normal, along = FACES[face]
    right = along if face in ("-y", "+x") else -along
    centre = on_face(face, p["wall"], p["at"], p["z"], 0.02)
    r = p["radius"]
    b.limb(f"{name}.rim", centre, centre + normal * 0.05, r, r, pal["iron"], 14)
    b.limb(f"{name}.field", centre + normal * 0.05, centre + normal * 0.07, r * 0.86, r * 0.82, pal["team"], 14)
    if p.get("emblem", True):
        _sigil(b, pal, f"{name}.emblem", emblem, centre + normal * 0.07, right, UP, normal, r * 0.6)
    else:
        b.ellipsoid(f"{name}.boss", centre + normal * 0.07, (r * 0.3, r * 0.3, r * 0.3), pal["iron"], detail=1)


def banner(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A pole with a long cloth in the team colour, ending in two tails, with the race's sigil on it."""
    x, y = p["at"]
    z0, h = p.get("z", 0.0), p["height"]
    w, length = p["cloth"]
    normal, along = FACES[p.get("face", "+x")]
    right = along if p.get("face", "+x") in ("-y", "+x") else -along
    top = Vector((x, y, z0 + h))
    b.limb(f"{name}.pole", (x, y, z0), top, 0.04, 0.03, pal["timber_dark"], 6)
    b.ellipsoid(f"{name}.knob", top, (0.06,) * 3, pal["iron"], detail=1)
    bar = top - UP * 0.1
    b.limb(f"{name}.bar", bar, bar + right * (w + 0.06), 0.025, 0.025, pal["timber_dark"], 4)
    origin = bar + right * 0.04 + normal * 0.03 - UP * 0.03
    rows = [
        [origin + right * (w * u) - UP * (length * t - (0.14 * length if (t == 1.0 and u == 0.5) else 0.0)) for u in (0.0, 0.5, 1.0)]
        for t in (0.0, 0.5, 1.0)
    ]
    b.sheet(f"{name}.cloth", [[tuple(point) for point in row] for row in rows], pal["team"])
    if p.get("emblem", True):
        _sigil(b, pal, f"{name}.emblem", emblem, origin + right * (w / 2) - UP * (length * 0.4) + normal * 0.01, right, UP, normal, w * 0.36)


def pennant(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A short pole with a small pointed flag in the team colour."""
    x, y = p["at"]
    z0, h = p.get("z", 0.0), p["height"]
    w, drop = p.get("flag", (0.45, 0.24))
    normal, along = FACES[p.get("face", "+x")]
    top = Vector((x, y, z0 + h))
    b.limb(f"{name}.pole", (x, y, z0), top, 0.03, 0.022, pal["timber_dark"], 6)
    a, c = top - UP * 0.03, top - UP * (0.03 + drop)
    tip = top + along * w - UP * (0.03 + drop / 2)
    b.sheet(f"{name}.flag", [[tuple(a + normal * 0.02), tuple(tip)], [tuple(c + normal * 0.02), tuple(tip)]], pal["team"])


def palisade(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A row of sharpened posts between two points."""
    start, end = Vector((*p["start"], p.get("z", 0.0))), Vector((*p["end"], p.get("z", 0.0)))
    h, r = p["height"], p.get("radius", 0.07)
    count = max(2, round((end - start).length / (r * 2.1)) + 1)
    for i in range(count):
        at = start.lerp(end, i / (count - 1))
        tall = h * (1.0 + 0.08 * ((i * 7) % 3 - 1))     # a little uneven, in a fixed pattern
        material = pal["timber"] if i % 2 == 0 else pal["timber_mid"]
        b.limb(f"{name}.post_{i}", at, at + UP * tall, r, r * 0.95, material, 6)
        b.limb(f"{name}.tip_{i}", at + UP * tall, at + UP * (tall + r * 2.2), r * 0.95, 0.0, pal["timber_new"], 6)


def barrel(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    x, y = p["at"]
    z0, r, h = p.get("z", 0.0), p.get("radius", 0.13), p.get("height", 0.3)
    b.limb(f"{name}.low", (x, y, z0), (x, y, z0 + h / 2), r * 0.86, r, pal["timber"], 8)
    b.limb(f"{name}.high", (x, y, z0 + h / 2), (x, y, z0 + h), r, r * 0.86, pal["timber"], 8)
    for i, share in enumerate((0.2, 0.8)):
        b.limb(f"{name}.band_{i}", (x, y, z0 + h * share - 0.015), (x, y, z0 + h * share + 0.015), r * 0.97, r * 0.97, pal["iron"], 8)
    b.limb(f"{name}.lid", (x, y, z0 + h), (x, y, z0 + h + 0.01), r * 0.8, r * 0.8, pal["timber_dark"], 8)


def crate(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    x, y = p["at"]
    z0, s = p.get("z", 0.0), p.get("size", 0.26)
    b.box(f"{name}.box", (x, y, z0 + s / 2), (s, s, s), pal["timber_new"])
    for i, dz in enumerate((0.12, 0.88)):
        b.box(f"{name}.edge_{i}", (x, y, z0 + s * dz), (s * 1.06, s * 1.06, s * 0.1), pal["timber_mid"])


def sack(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    x, y = p["at"]
    z0, s = p.get("z", 0.0), p.get("size", 0.15)
    b.ellipsoid(f"{name}.body", (x, y, z0 + s * 0.8), (s, s * 0.9, s), pal["sack"], detail=1)
    b.ellipsoid(f"{name}.neck", (x, y, z0 + s * 1.8), (s * 0.35, s * 0.35, s * 0.3), pal["sack_dark"], detail=1)


def logpile(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """Logs stacked in a small pyramid, lying along x or y."""
    x, y = p["at"]
    z0, r, length = p.get("z", 0.0), p.get("radius", 0.07), p.get("length", 0.5)
    lie = Vector((1.0, 0.0, 0.0)) if p.get("along", "x") == "x" else Vector((0.0, 1.0, 0.0))
    side = Vector((-lie.y, lie.x, 0.0))
    rows = p.get("rows", 3)
    i = 0
    for row in range(rows):
        for k in range(rows - row):
            centre = Vector((x, y, z0 + r + row * r * 1.75)) + side * ((k - (rows - row - 1) / 2) * r * 2.05)
            b.limb(f"{name}.log_{i}", centre - lie * length / 2, centre + lie * length / 2, r, r, pal["log"], 6)
            for e, sign in enumerate((1.0, -1.0)):
                tip = centre + lie * sign * length / 2
                b.limb(f"{name}.end_{i}_{e}", tip, tip + lie * sign * 0.01, r * 0.85, r * 0.85, pal["log_end"], 6)
            i += 1


def planks(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A stack of sawn planks, for a building site."""
    x, y = p["at"]
    z0, length, count = p.get("z", 0.0), p.get("length", 0.6), p.get("count", 4)
    along_x = p.get("along", "x") == "x"
    for i in range(count):
        size = (length, 0.2, 0.035) if along_x else (0.2, length, 0.035)
        shift = 0.02 * ((i * 5) % 3 - 1)
        centre = (x + (shift if along_x else 0.0), y + (0.0 if along_x else shift), z0 + 0.02 + i * 0.04)
        b.box(f"{name}.plank_{i}", centre, size, pal["timber_new"])


def rack(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A weapon rack: two posts and a rail, with spears leaning on it and shields in the team colour."""
    x, y = p["at"]
    z0, w, h = p.get("z", 0.0), p.get("width", 0.7), p.get("height", 0.5)
    normal, along = FACES[p.get("face", "-y")]
    centre = Vector((x, y, z0))
    for i, sign in enumerate((-1.0, 1.0)):
        foot = centre + along * sign * w / 2
        b.limb(f"{name}.post_{i}", foot, foot + UP * h, 0.035, 0.035, pal["timber_dark"], 4)
    b.limb(f"{name}.rail", centre + along * (-w / 2) + UP * h * 0.9, centre + along * (w / 2) + UP * h * 0.9, 0.03, 0.03, pal["timber_dark"], 4)
    for i, share in enumerate((-0.3, 0.0, 0.3)):
        foot = centre + along * share * w + normal * 0.16
        head = centre + along * share * w + UP * (h * 1.45)
        b.limb(f"{name}.spear_{i}", foot, head, 0.018, 0.018, pal["timber_new"], 4)
        b.limb(f"{name}.spear_tip_{i}", head, head + (head - foot).normalized() * 0.14, 0.035, 0.0, pal["iron"], 4)
    for i, share in enumerate((-0.17, 0.17)):
        at = centre + along * share * w + normal * 0.08 + UP * h * 0.45
        b.limb(f"{name}.shield_{i}", at, at + normal * 0.03, 0.13, 0.13, pal["iron"], 10)
        b.limb(f"{name}.shield_field_{i}", at + normal * 0.03, at + normal * 0.045, 0.105, 0.1, pal["team"], 10)


def dummy(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A training dummy: a post with a crossbar, a stuffed sack for a body and a head."""
    x, y = p["at"]
    z0, h = p.get("z", 0.0), p.get("height", 0.62)
    normal, along = FACES[p.get("face", "-y")]
    foot = Vector((x, y, z0))
    b.limb(f"{name}.post", foot, foot + UP * h, 0.035, 0.035, pal["timber_dark"], 4)
    arm = foot + UP * h * 0.72
    b.limb(f"{name}.arms", arm - along * 0.22, arm + along * 0.22, 0.03, 0.03, pal["timber_dark"], 4)
    b.ellipsoid(f"{name}.body", foot + UP * h * 0.58, (0.13, 0.11, 0.17), pal["sack"], detail=1)
    b.ellipsoid(f"{name}.head", foot + UP * (h + 0.04), (0.08, 0.08, 0.09), pal["sack_dark"], detail=1)
    target = foot + UP * h * 0.6 + normal * 0.11
    b.limb(f"{name}.mark", target, target + normal * 0.012, 0.06, 0.06, pal["team"], 8)


def scaffold(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """Scaffolding along the two walls the player sees: poles, a walkway of planks and a ladder."""
    x0, y0, x1, y1 = p["box"]
    h = p["height"]
    wood = pal["timber_new"]
    out = p.get("out", 0.14)
    lines = (
        (Vector((x0, y0 - out, 0)), Vector((x1, y0 - out, 0)), "a"),
        (Vector((x1 + out, y0, 0)), Vector((x1 + out, y1, 0)), "b"),
    )
    for start, end, tag in lines:
        n = max(2, round((end - start).length / 0.7) + 1)
        for i in range(n):
            at = start.lerp(end, i / (n - 1))
            b.limb(f"{name}.pole_{tag}_{i}", at, at + UP * h, 0.025, 0.025, wood, 4)
        for level, share in enumerate((0.5, 0.97)):
            b.limb(f"{name}.rail_{tag}_{level}", start + UP * h * share, end + UP * h * share, 0.022, 0.022, wood, 4)
        middle = (start + end) / 2 + UP * h * 0.5
        across = Vector((0.0, 1.0, 0.0)) if tag == "a" else Vector((-1.0, 0.0, 0.0))
        size = ((end - start).length, 0.16, 0.03) if tag == "a" else (0.16, (end - start).length, 0.03)
        b.box(f"{name}.walk_{tag}", middle + across * 0.07, size, wood)
    foot = Vector((x0 + (x1 - x0) * 0.2, y0 - out - 0.12, 0))
    for i, shift in enumerate((-0.06, 0.06)):
        b.limb(f"{name}.ladder_{i}", foot + Vector((shift, 0, 0)), foot + Vector((shift, 0.12, h * 0.52)), 0.015, 0.015, wood, 4)
    for i in range(4):
        rung = foot + Vector((0, 0.12 * (i + 0.5) / 4, h * 0.52 * (i + 0.5) / 4))
        b.limb(f"{name}.rung_{i}", rung - Vector((0.06, 0, 0)), rung + Vector((0.06, 0, 0)), 0.012, 0.012, wood, 4)


def chimney(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    x, y = p["at"]
    z0, z1, s = p["z"][0], p["z"][1], p.get("size", 0.26)
    b.box(f"{name}.stack", (x, y, (z0 + z1) / 2), (s, s, z1 - z0), pal["stone"])
    b.box(f"{name}.rim", (x, y, z1), (s * 1.25, s * 1.25, 0.06), pal["stone_dark"])


def beam(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A single timber between two points, for porches and lean-tos."""
    b.limb(name, tuple(p["start"]), tuple(p["end"]), p.get("radius", 0.05), p.get("radius", 0.05), pal[p.get("material", "timber_dark")], p.get("sides", 4))


def slab(b: Builder, pal: Palette, p: dict, name: str, emblem) -> None:
    """A plain box of any material: a step, a platform, a lean-to roof."""
    x0, y0, x1, y1 = p["box"]
    z0, z1 = p["z"]
    b.box(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), pal[p.get("material", "timber")])


PARTS = {
    "base": base,
    "walls": walls,
    "frame": frame_posts,
    "gable_roof": gable_roof,
    "rafters": rafters,
    "spire": spire,
    "door": door,
    "shield": shield,
    "banner": banner,
    "pennant": pennant,
    "palisade": palisade,
    "barrel": barrel,
    "crate": crate,
    "sack": sack,
    "logpile": logpile,
    "planks": planks,
    "rack": rack,
    "dummy": dummy,
    "scaffold": scaffold,
    "chimney": chimney,
    "beam": beam,
    "slab": slab,
}

# The stages a building is shown in, in order. A part is in the picture from
# its `from` stage to its `until` stage; by default only in the finished building.
STAGES = ("construction_1", "construction_2", "complete")


def build_structure(b: Builder, pal: Palette, building: dict, emblem) -> dict[str, list]:
    """
    Builds every part of a building. Returns, for each stage, the objects
    that are in the picture at that stage.
    """
    by_stage: dict[str, list] = {stage: [] for stage in STAGES}
    for index, part in enumerate(building["part"]):
        kind = part["type"]
        if kind not in PARTS:
            raise SystemExit(f"Building {building['name']!r}: unknown part type {kind!r}")
        before = len(b.parts)
        PARTS[kind](b, pal, part, f"s{index:02d}_{kind}", emblem)
        made = b.parts[before:]
        first = STAGES.index(part.get("from", "complete"))
        last = STAGES.index(part.get("until", "complete"))
        for stage in STAGES[first : last + 1]:
            by_stage[stage].extend(made)
    return by_stage
