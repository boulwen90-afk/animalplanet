"""Puts a figure together: a race's body wearing a unit type's armour and weapons."""

from .armor import build_armor
from .body import build_body
from .materials import Palette
from .mesh import Builder
from .skeleton import posed_joints
from .weapons import build_shield, build_weapon

# Colour names that get a metal material instead of a matt one.
METALS = ("steel", "steel_dark", "blade", "brass", "mail")


def build_figure(race: dict, unit: dict, team_color: str) -> Builder:
    """Builds one figure at the origin, standing on z = 0 and facing -Y."""
    palette = Palette(team_color)
    palette.add_all(race["colors"])
    palette.add_all(unit["colors"], metal=METALS)

    joints = posed_joints(race["proportions"], unit.get("pose"))
    builder = Builder(f"{race['name']}_{unit['name']}")

    build_body(builder, race, joints, palette)
    build_armor(builder, race, unit, joints, palette)

    weapon = unit.get("weapon")
    if weapon:
        side = "r" if weapon.get("hand", "right") == "right" else "l"
        build_weapon(builder, weapon, joints[f"hand_{side}"], palette)
    shield = unit.get("shield")
    if shield:
        side = "l" if shield.get("arm", "left") == "left" else "r"
        build_shield(builder, shield, joints[f"elbow_{side}"], joints[f"hand_{side}"], palette)

    return builder
