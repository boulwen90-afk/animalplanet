"""Weapons and shields. Each is a separate part held in a hand or strapped to a forearm."""

import math

from mathutils import Matrix, Vector

from .emblem import build_emblem
from .materials import Palette
from .mesh import Builder, frame


def build_weapon(b: Builder, weapon: dict, hand: Vector, pal: Palette) -> None:
    """Puts a weapon in a hand. `direction` is where the blade or head points."""
    d = Vector(weapon["direction"]).normalized()
    wide = tuple(weapon.get("flat_axis", (1.0, 0.0, 0.0)))
    turn = frame(d, wide)
    across, thin = turn.col[0].xyz, turn.col[1].xyz
    length = weapon["length"]
    kind = weapon["type"]

    if kind == "sword":
        width = weapon.get("width", 0.2)
        b.limb("weapon.grip", hand - d * 0.15, hand + d * 0.15, 0.05, 0.05, pal["leather"], 6)
        b.ellipsoid("weapon.pommel", hand - d * 0.21, (0.085,) * 3, pal["brass"], detail=1)
        # A broad cross-guard whose ends turn towards the blade.
        guard = hand + d * 0.19
        b.box("weapon.guard", guard, (width * 2.6, 0.1, 0.08), pal["brass"], turn)
        for sign in (1.0, -1.0):
            b.box(
                f"weapon.guard_end_{'a' if sign > 0 else 'b'}",
                guard + across * sign * width * 1.25 + d * 0.05,
                (0.09, 0.1, 0.16),
                pal["brass"],
                turn,
            )
        base = hand + d * 0.23
        shoulder = hand + d * (0.23 + length * 0.82)
        tip = hand + d * (0.23 + length)
        b.limb("weapon.blade", base, shoulder, width * 0.5, width * 0.44, pal["blade"], 4, 0.26, wide)
        b.limb("weapon.blade_tip", shoulder, tip, width * 0.44, 0.0, pal["blade"], 4, 0.26, wide)
        # A darker groove down the middle of the blade, on both sides.
        for sign in (1.0, -1.0):
            b.box(
                f"weapon.fuller_{'a' if sign > 0 else 'b'}",
                base.lerp(shoulder, 0.42) + thin * sign * width * 0.115,
                (width * 0.22, 0.012, length * 0.6),
                pal["steel_dark"],
                turn,
            )
    elif kind == "axe":
        top = hand + d * length
        b.limb("weapon.haft", hand - d * 0.25, top, 0.05, 0.045, pal["wood"], 6)
        head = top - d * 0.2 + across * 0.2
        b.box("weapon.axe_head", head, (0.34, 0.07, 0.34), pal["blade"], turn)
        b.box("weapon.axe_edge", head + across * 0.2, (0.07, 0.045, 0.5), pal["steel_dark"], turn)
        b.limb("weapon.axe_spike", top, top + d * 0.18, 0.05, 0.0, pal["steel_dark"], 4)
    else:
        raise ValueError(f"Unknown weapon type {kind!r}")


def build_shield(
    b: Builder,
    shield: dict,
    elbow: Vector,
    hand: Vector,
    clearance: float,
    pal: Palette,
    emblem: dict | None = None,
) -> None:
    """
    Straps a shield to a forearm. `normal` is the way its face points, and
    `clearance` how far from the arm the shield must sit to clear the hand.
    """
    n = Vector(shield["normal"]).normalized()
    radius = shield["radius"]
    centre = elbow.lerp(hand, 0.6) + n * (clearance + 0.08)
    turn = frame(n, (1.0, 0.0, 0.0))
    right, up = turn.col[0].xyz, turn.col[1].xyz
    kind = shield["type"]

    if kind == "round":
        # A wooden disc with an iron rim, a field in the team colour and a boss in the middle.
        b.limb("shield.back", centre - n * 0.06, centre - n * 0.03, radius * 0.92, radius * 0.97, pal["wood"], 16)
        b.limb("shield.rim", centre - n * 0.03, centre + n * 0.05, radius, radius, pal["steel_dark"], 16)
        b.limb("shield.field", centre + n * 0.05, centre + n * 0.075, radius * 0.86, radius * 0.82, pal["team"], 16)
        sigil = emblem if shield.get("emblem") == "race" else None
        if sigil:
            # The race's sigil fills the field, as on a coat of arms.
            reach = radius * 0.6
            build_emblem(
                b,
                "shield.emblem",
                sigil,
                lambda x, y, h: centre + right * x * reach + up * y * reach + n * (0.075 + h),
                pal,
            )
        else:
            b.ellipsoid(
                "shield.boss",
                centre + n * 0.07,
                (radius * 0.3, radius * 0.3, radius * 0.2),
                pal["brass"],
                detail=1,
                rotation=turn,
            )
            if shield.get("spike"):
                b.limb(
                    "shield.spike", centre + n * 0.14, centre + n * 0.36, radius * 0.11, 0.0, pal["brass"], 6
                )
        if shield.get("emblem") == "claws":
            # Three claw marks slashed across the field.
            slant = turn @ Matrix.Rotation(-0.5, 4, "Z")
            along = slant.col[1].xyz
            for i in (-1, 0, 1):
                middle = centre + right * i * radius * 0.3 + up * i * radius * 0.04 + n * 0.082
                for end in (1.0, -1.0):
                    b.box(
                        f"shield.claw_{i + 1}_{'a' if end > 0 else 'b'}",
                        middle + along * end * radius * 0.5,
                        (radius * 0.1, radius * (0.34 - abs(i) * 0.06), 0.018),
                        pal["claw"],
                        slant,
                    )
        # Rivets around the rim.
        count = 8
        for i in range(count):
            angle = 2 * math.pi * i / count
            offset = (right * math.cos(angle) + up * math.sin(angle)) * radius * 0.93
            b.ellipsoid(f"shield.rivet_{i}", centre + offset + n * 0.055, (0.04,) * 3, pal["brass"], detail=1)
    else:
        raise ValueError(f"Unknown shield type {kind!r}")
