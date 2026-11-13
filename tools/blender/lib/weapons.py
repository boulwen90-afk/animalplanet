"""Weapons and shields. Each is a separate part held in a hand or strapped to a forearm."""

from mathutils import Vector

from .materials import Palette
from .mesh import Builder, frame


def build_weapon(b: Builder, weapon: dict, hand: Vector, pal: Palette) -> None:
    """Puts a weapon in a hand. `direction` is where the blade or head points."""
    d = Vector(weapon["direction"]).normalized()
    wide = tuple(weapon.get("flat_axis", (1.0, 0.0, 0.0)))
    length = weapon["length"]
    kind = weapon["type"]

    if kind == "sword":
        width = weapon.get("width", 0.16)
        b.limb("weapon.grip", hand - d * 0.13, hand + d * 0.13, 0.045, 0.045, pal["leather"], 6)
        b.ellipsoid("weapon.pommel", hand - d * 0.18, (0.07,) * 3, pal["brass"], detail=1)
        b.box("weapon.guard", hand + d * 0.16, (width * 2.3, 0.08, 0.07), pal["brass"], frame(d, wide))
        base, shoulder, tip = hand + d * 0.19, hand + d * (0.19 + length * 0.8), hand + d * (0.19 + length)
        b.limb("weapon.blade", base, shoulder, width * 0.5, width * 0.42, pal["blade"], 4, 0.28, wide)
        b.limb("weapon.blade_tip", shoulder, tip, width * 0.42, 0.0, pal["blade"], 4, 0.28, wide)
    elif kind == "axe":
        top = hand + d * length
        b.limb("weapon.haft", hand - d * 0.2, top, 0.045, 0.04, pal["wood"], 6)
        side = frame(d, wide).col[0].xyz
        head = top - d * 0.16 + side * 0.17
        b.box("weapon.axe_head", head, (0.3, 0.06, 0.3), pal["blade"], frame(d, wide))
        b.box("weapon.axe_edge", head + side * 0.17, (0.06, 0.04, 0.42), pal["steel_dark"], frame(d, wide))
    else:
        raise ValueError(f"Unknown weapon type {kind!r}")


def build_shield(b: Builder, shield: dict, elbow: Vector, hand: Vector, pal: Palette) -> None:
    """Straps a shield to a forearm. `normal` is the way its face points."""
    n = Vector(shield["normal"]).normalized()
    radius = shield["radius"]
    centre = elbow.lerp(hand, 0.6) + n * 0.17
    kind = shield["type"]

    if kind == "round":
        # A wooden disc with a steel rim, a field in the team colour and a boss in the middle.
        b.limb("shield.rim", centre - n * 0.035, centre + n * 0.035, radius, radius, pal["steel_dark"], 14)
        b.limb("shield.field", centre + n * 0.035, centre + n * 0.1, radius * 0.86, radius * 0.4, pal["team"], 14)
        b.limb("shield.back", centre - n * 0.05, centre - n * 0.035, radius * 0.9, radius * 0.95, pal["wood"], 14)
        b.ellipsoid(
            "shield.boss",
            centre + n * 0.09,
            (radius * 0.3, radius * 0.3, radius * 0.22),
            pal["brass"],
            detail=1,
            rotation=frame(n),
        )
        # Four rivets on the rim.
        across = frame(n)
        for i, (u, v) in enumerate(((1, 0), (0, 1), (-1, 0), (0, -1))):
            offset = (across.col[0].xyz * u + across.col[1].xyz * v) * radius * 0.93
            b.ellipsoid(f"shield.rivet_{i}", centre + offset + n * 0.04, (0.035,) * 3, pal["brass"], detail=1)
    else:
        raise ValueError(f"Unknown shield type {kind!r}")
