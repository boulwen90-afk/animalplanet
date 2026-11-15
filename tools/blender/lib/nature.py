"""
What stands on the ground between the buildings: trees, stumps, berry bushes,
rocks, caves and the marks of a fishing place. Each is put together from the
same simple shapes as the buildings, in tiles, standing on the middle of its
tile at z = 0. Here are also the smoke and the flames of a damaged building,
and the hammer that marks a repair: small pictures the game puts where it
needs them.
"""

import math

from mathutils import Matrix, Vector

from .materials import Palette
from .mesh import Builder

UP = Vector((0.0, 0.0, 1.0))


def _at(p: dict) -> Vector:
    x, y = p.get("at", (0.0, 0.0))
    return Vector((x, y, 0.0))


def conifer(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """A spruce: a short trunk and tiers of branches, each narrower than the one below."""
    foot = _at(p)
    height, radius, tiers = p["height"], p["radius"], p.get("tiers", 4)
    trunk = p.get("trunk", 0.16) * height
    lean = Vector((p.get("lean", 0.0), 0.0, 0.0))
    b.limb(f"{name}.trunk", foot, foot + UP * (trunk + 0.1), 0.07, 0.055, pal["bark"], 6)
    for i in range(tiers):
        t0, t1 = i / tiers, (i + 1) / tiers
        low = foot + UP * (trunk + (height - trunk) * t0 * 0.82) + lean * t0
        high = foot + UP * (trunk + (height - trunk) * min(1.0, t1 * 0.82 + 0.3)) + lean * t1
        width = radius * (1 - 0.72 * t0)
        material = pal["needle_dark"] if i % 2 == 0 else pal["needle"]
        b.limb(f"{name}.tier_{i}", low, high, width, 0.0, material, p.get("sides", 7))


def broadleaf(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """A leafy tree: a trunk that forks, and a crown of a few rounded clumps."""
    foot = _at(p)
    height, radius = p["height"], p["radius"]
    fork = foot + UP * height * 0.3
    b.limb(f"{name}.trunk", foot, fork, 0.1, 0.07, pal["bark"], 6)
    clumps = p.get(
        "clumps",
        ((0.0, 0.0, 0.72, 0.9), (-0.55, 0.1, 0.52, 0.66), (0.5, -0.2, 0.56, 0.7), (0.1, 0.5, 0.5, 0.6), (0.05, -0.5, 0.44, 0.6)),
    )
    for i, (x, y, z, size) in enumerate(clumps):
        centre = foot + Vector((x * radius, y * radius, height * z))
        b.limb(f"{name}.branch_{i}", fork, centre, 0.04, 0.02, pal["bark"], 5)
        material = pal["leaf"] if i % 2 == 0 else pal["leaf_dark"]
        b.ellipsoid(f"{name}.clump_{i}", centre, (radius * size, radius * size, radius * size * 0.8), material, detail=1)


def stump(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """What is left of a felled tree: a low stump with a pale cut top, and chips on the ground."""
    foot = _at(p)
    r, h = p.get("radius", 0.12), p.get("height", 0.14)
    b.limb(f"{name}.wood", foot, foot + UP * h, r * 1.25, r, pal["bark"], 7)
    b.limb(f"{name}.cut", foot + UP * h, foot + UP * (h + 0.012), r * 0.92, r * 0.92, pal["wood_cut"], 7)
    for i, (x, y, turn) in enumerate(((0.2, -0.12, 0.4), (-0.18, -0.2, 1.3), (0.05, 0.22, 2.2))):
        b.box(f"{name}.chip_{i}", foot + Vector((x, y, 0.012)), (0.09, 0.035, 0.02), pal["wood_cut"], Matrix.Rotation(turn, 4, "Z"))


def bush(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """A berry bush: a few low rounded clumps of leaves, with as many berries on it as the config says."""
    foot = _at(p)
    size = p.get("size", 0.3)
    clumps = ((0.0, 0.0, 0.5, 1.0), (-0.5, 0.15, 0.36, 0.72), (0.5, -0.1, 0.38, 0.75), (0.05, -0.45, 0.3, 0.6))
    for i, (x, y, z, scale) in enumerate(clumps):
        centre = foot + Vector((x * size, y * size, z * size))
        material = pal["leaf"] if i % 2 == 0 else pal["leaf_dark"]
        b.ellipsoid(f"{name}.clump_{i}", centre, (size * scale * 0.75, size * scale * 0.75, size * scale * 0.6), material, detail=1)
    # Berries sit on the outside of the clumps, at fixed places; fewer when the bush has been picked at.
    # The side towards the viewer is +x, -y.
    spots = (
        (0.25, -0.25, 0.98), (0.62, -0.1, 0.62), (0.1, -0.62, 0.56), (0.5, -0.5, 0.42), (-0.25, -0.5, 0.72),
        (0.7, 0.25, 0.7), (-0.05, 0.0, 1.06), (0.8, -0.3, 0.3), (-0.55, -0.3, 0.5), (0.3, -0.75, 0.24),
    )
    for i, (x, y, z) in enumerate(spots[: p.get("berries", 0)]):
        centre = foot + Vector((x * size, y * size, z * size))
        b.ellipsoid(f"{name}.berry_{i}", centre, (0.075, 0.075, 0.075), pal["berry" if i % 3 else "berry_light"], detail=1)


def boulders(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """Rocks: faceted stones of the sizes and places the config lists, each turned a little."""
    foot = _at(p)
    for i, (x, y, rx, ry, rz, turn) in enumerate(p["stones"]):
        rotation = Matrix.Rotation(turn, 4, "Z") @ Matrix.Rotation(0.25 * math.sin(turn * 3), 4, "X")
        material = pal[("rock", "rock_light", "rock_dark")[i % 3]]
        b.ellipsoid(f"{name}.stone_{i}", foot + Vector((x, y, rz * 0.62)), (rx, ry, rz), material, detail=1, rotation=rotation)


def cave(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """A cave: a mound of rock with a dark opening towards the viewer, and a pennant in the team colour."""
    foot = _at(p)
    r, h = p.get("radius", 0.42), p.get("height", 0.5)
    b.ellipsoid(f"{name}.mound", foot, (r, r, h), pal["rock"], detail=1, keep_above=0.0)
    b.ellipsoid(f"{name}.shoulder_a", foot + Vector((-r * 0.6, r * 0.25, 0.0)), (r * 0.55, r * 0.5, h * 0.6), pal["rock_dark"], detail=1, keep_above=0.0)
    b.ellipsoid(f"{name}.shoulder_b", foot + Vector((r * 0.45, r * 0.55, 0.0)), (r * 0.5, r * 0.5, h * 0.7), pal["rock_light"], detail=1, keep_above=0.0)
    # The opening faces the corner of the tile nearest the viewer.
    out = Vector((1.0, -1.0, 0.0)).normalized()
    mouth = foot + out * r * 0.62
    b.ellipsoid(f"{name}.mouth", mouth, (r * 0.42, r * 0.42, h * 0.62), pal["cave_dark"], detail=1, keep_above=0.0)
    for i, sign in enumerate((-1.0, 1.0)):
        side = Vector((1.0, 1.0, 0.0)).normalized() * sign
        b.ellipsoid(f"{name}.jamb_{i}", mouth + side * r * 0.42 + out * 0.03, (r * 0.2, r * 0.2, h * 0.5), pal["rock_light" if i else "rock_dark"], detail=1, keep_above=0.0)
    # Whose cave it is: a pennant on a pole beside the opening.
    pole = mouth + Vector((1.0, 1.0, 0.0)).normalized() * r * 0.7
    top = pole + UP * p.get("pole", 0.7)
    b.limb(f"{name}.pole", pole, top, 0.022, 0.018, pal["bark"], 5)
    # It flies across the picture: along +x, +y, which is to the right on the screen.
    across = Vector((1.0, 1.0, 0.0)).normalized()
    b.sheet(
        f"{name}.pennant",
        [
            [tuple(top - UP * 0.02), tuple(top - UP * 0.3)],
            [tuple(top - UP * 0.16 + across * 0.36), tuple(top - UP * 0.16 + across * 0.36)],
        ],
        pal["team"],
    )


def fishing_place(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """
    The marks of a fishing place on the shore: a worn patch of pebbles, a
    bucket for the catch and a forked stick to rest the rod in. It looks the
    same whichever side the water is on.
    """
    foot = _at(p)
    for i, (x, y, r) in enumerate(((0.0, 0.0, 0.2), (0.14, 0.1, 0.11), (-0.15, -0.06, 0.1), (0.04, -0.17, 0.09))):
        b.limb(f"{name}.patch_{i}", foot + Vector((x, y, 0.0)), foot + Vector((x, y, 0.012)), r, r * 0.9, pal["sand_dark" if i else "sand"], 8)
    bucket = foot + Vector((-0.2, 0.16, 0.012))
    b.limb(f"{name}.bucket", bucket, bucket + UP * 0.13, 0.055, 0.07, pal["wood_cut"], 8)
    b.limb(f"{name}.bucket_band", bucket + UP * 0.09, bucket + UP * 0.105, 0.068, 0.07, pal["bark"], 8)
    b.limb(f"{name}.bucket_water", bucket + UP * 0.13, bucket + UP * 0.134, 0.06, 0.06, pal["fish"], 8)
    stick = foot + Vector((0.2, -0.16, 0.0))
    fork = stick + UP * 0.2
    b.limb(f"{name}.stick", stick, fork, 0.016, 0.014, pal["bark"], 4)
    for i, sign in enumerate((-1.0, 1.0)):
        b.limb(f"{name}.fork_{i}", fork, fork + Vector((sign * 0.05, sign * 0.05, 0.08)), 0.013, 0.01, pal["bark"], 4)


def smoke(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """A puff of smoke: a few rounded grey clumps, each (x, y, z, radius) as the config lists them."""
    foot = _at(p)
    for i, (x, y, z, r) in enumerate(p["clumps"]):
        material = pal[("smoke", "smoke_light", "smoke_dark")[i % 3]]
        rotation = Matrix.Rotation(0.9 * i + p.get("turn", 0.0), 4, "Z")
        b.ellipsoid(f"{name}.clump_{i}", foot + Vector((x, y, z)), (r, r, r * 0.9), material, detail=2, rotation=rotation)


def flame(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """
    Flames: pointed tongues that rise from the ground, each (across, height,
    radius, lean) as the config lists them, with a paler core in each.
    `across` runs to the right on the screen.
    """
    foot = _at(p)
    right = Vector((1.0, 1.0, 0.0)).normalized()
    front = Vector((1.0, -1.0, 0.0)).normalized()
    for i, (across, height, radius, lean) in enumerate(p["tongues"]):
        base = foot + right * across
        tip = base + UP * height + right * lean
        b.limb(f"{name}.tongue_{i}", base, tip, radius, 0.0, pal["flame" if i % 2 == 0 else "flame_dark"], 6)
        # The core stands a little towards the viewer, so that it shows in front of the tongue.
        core = base + front * radius * 0.55
        b.limb(f"{name}.core_{i}", core, core + UP * height * 0.55 + right * lean * 0.5, radius * 0.5, 0.0, pal["flame_core"], 5)


def hammer(b: Builder, pal: Palette, p: dict, name: str) -> None:
    """A hammer standing on its handle, head up and leaning to the right: the sign of a repair."""
    foot = _at(p)
    right = Vector((1.0, 1.0, 0.0)).normalized()
    length, lean = p.get("length", 0.5), p.get("lean", 0.22)
    top = foot + UP * length + right * lean
    b.limb(f"{name}.handle", foot, top, 0.035, 0.03, pal["wood_cut"], 6)
    along = (top - foot).normalized()
    across = right - along * right.dot(along)
    across.normalize()
    half = p.get("head", 0.15)
    b.limb(f"{name}.head", top - across * half, top + across * half, 0.07, 0.07, pal["iron"], 6)
    b.limb(f"{name}.face", top + across * half, top + across * (half + 0.03), 0.08, 0.08, pal["iron_light"], 6)


PARTS = {
    "smoke": smoke,
    "flame": flame,
    "hammer": hammer,
    "conifer": conifer,
    "broadleaf": broadleaf,
    "stump": stump,
    "bush": bush,
    "boulders": boulders,
    "cave": cave,
    "fishing_place": fishing_place,
}
