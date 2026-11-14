"""Puts a figure together: a race's body wearing a unit type's armour and weapons."""

from .armor import build_armor
from .body import build_body
from .coat import build_coat
from .emblem import load_emblem
from .materials import Palette
from .mesh import Builder
from .skeleton import Rig, full_pose, solve
from .weapons import build_shield, build_weapon

# Colour names that get a metal material instead of a matt one.
METALS = ("steel", "steel_dark", "blade", "brass", "mail")


class Figure:
    """A built figure: its parts, the skeleton they hang on, and what it was built from."""

    def __init__(
        self, builder: Builder, rig: Rig, race: dict, unit: dict, stance: dict, scale: float
    ) -> None:
        self.builder = builder
        self.parts = builder.parts
        self.rig = rig
        self.race = race
        self.unit = unit
        # How much the whole figure is scaled to fit the size standard.
        self.scale = scale
        # The pose the figure was built in. Animations start from it.
        self.stance = stance


def stance_of(unit: dict) -> dict:
    """The unit's standing pose, with the way it holds its weapon and shield."""
    stance = dict(unit.get("pose") or {})
    weapon, shield = unit.get("weapon"), unit.get("shield")
    if weapon:
        stance.setdefault("weapon_dir", tuple(weapon["direction"]))
        stance.setdefault("weapon_flat", tuple(weapon.get("flat_axis", (1.0, 0.0, 0.0))))
    if shield:
        stance.setdefault("shield_normal", tuple(shield["normal"]))
    return full_pose(stance)


def build_figure(
    race: dict,
    unit: dict,
    team_color: str,
    style: dict | None = None,
    emblem_color: str = "#ece2c8",
    scale: float = 1.0,
) -> Figure:
    """
    Builds one figure at the origin, standing on z = 0 and facing -Y, bound to
    its skeleton. It is built in its race's own proportions and then scaled as
    a whole by `scale`, which comes from the size standard (lib/scale.py).
    """
    palette = Palette(team_color)
    palette.add_all(race["colors"])
    palette.add_all(unit["colors"], metal=METALS)
    palette.add("emblem", emblem_color)
    emblem = load_emblem(race["emblem"]) if race.get("emblem") else None

    stance = stance_of(unit)
    rest = solve(race["proportions"], stance)
    joints, head_turn = rest.joints, rest.head_turn
    name = f"{race['name']}_{unit['name']}"
    builder = Builder(name, (style or {}).get("smooth_deg"))

    build_body(builder, race, joints, head_turn, palette)
    build_coat(builder, race, joints, head_turn, palette)
    build_armor(builder, race, unit, joints, head_turn, palette, emblem)

    weapon = unit.get("weapon")
    if weapon:
        side = "r" if weapon.get("hand", "right") == "right" else "l"
        builder.attach(f"hand_{side}")
        build_weapon(builder, weapon, joints[f"hand_{side}"], palette)
    # Other things the figure can hold in the same hand. They follow the hand
    # exactly as the weapon does, and the build shows one of them at a time.
    for tool in unit.get("tool", []):
        side = "r" if tool.get("hand", "right") == "right" else "l"
        builder.attach(f"hand_{side}")
        held = {**tool, "direction": stance["weapon_dir"], "flat_axis": stance["weapon_flat"]}
        build_weapon(builder, held, joints[f"hand_{side}"], palette, f"tool.{tool['name']}")
    shield = unit.get("shield")
    if shield:
        side = "l" if shield.get("arm", "left") == "left" else "r"
        clearance = race["proportions"]["hand_radius"]
        builder.attach(f"forearm_{side}")
        build_shield(
            builder,
            shield,
            joints[f"elbow_{side}"],
            joints[f"hand_{side}"],
            clearance,
            palette,
            emblem,
        )

    rig = Rig(name, rest, builder.parts, builder.bone_of)
    rig.object.scale = (scale, scale, scale)
    return Figure(builder, rig, race, unit, stance, scale)
