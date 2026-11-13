"""Puts a figure together: a race's body wearing a unit type's armour and weapons."""

from .armor import build_armor
from .body import build_body
from .emblem import load_emblem
from .materials import Palette
from .mesh import Builder
from .skeleton import head_rotation, posed_joints
from .weapons import build_shield, build_weapon

# Colour names that get a metal material instead of a matt one.
METALS = ("steel", "steel_dark", "blade", "brass", "mail")


def build_figure(
    race: dict, unit: dict, team_color: str, style: dict | None = None, emblem_color: str = "#ece2c8"
) -> Builder:
    """Builds one figure at the origin, standing on z = 0 and facing -Y."""
    palette = Palette(team_color)
    palette.add_all(race["colors"])
    palette.add_all(unit["colors"], metal=METALS)
    palette.add("emblem", emblem_color)
    emblem = load_emblem(race["emblem"]) if race.get("emblem") else None

    pose = unit.get("pose")
    joints = posed_joints(race["proportions"], pose)
    head_turn = head_rotation(pose)
    builder = Builder(f"{race['name']}_{unit['name']}", (style or {}).get("smooth_deg"))

    build_body(builder, race, joints, head_turn, palette)
    build_armor(builder, race, unit, joints, head_turn, palette, emblem)

    weapon = unit.get("weapon")
    if weapon:
        side = "r" if weapon.get("hand", "right") == "right" else "l"
        build_weapon(builder, weapon, joints[f"hand_{side}"], palette)
    shield = unit.get("shield")
    if shield:
        side = "l" if shield.get("arm", "left") == "left" else "r"
        clearance = race["proportions"]["hand_radius"]
        build_shield(
            builder,
            shield,
            joints[f"elbow_{side}"],
            joints[f"hand_{side}"],
            clearance,
            palette,
            emblem,
        )

    return builder
