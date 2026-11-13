"""
The size standard: how large figures and buildings are in the game.

Every size is given in tile widths, the width of a ground tile on the screen.
A figure is built in its race's own proportions and then scaled as a whole, so
that its height matches its size class. No figure sets its own size, which
keeps every race and unit in the same scale. See architecture.md.
"""

import math


def tile_side_units(game: dict) -> float:
    """The side of a ground tile in Blender units, at the scale the game is rendered in."""
    sprite = game["sprite"]
    return sprite["tile_width"] / math.sqrt(2) / sprite["pixels_per_unit"]


def natural_height(race: dict) -> float:
    """From the ground to the top of the head of a race standing upright, in its own proportions."""
    p = race["proportions"]
    return p["hip_height"] + p["torso_length"] + p["head_radii"][2] * 1.72


def natural_body_width(race: dict) -> float:
    """Across the shoulders with shoulder armour on, in the race's own proportions."""
    p = race["proportions"]
    return 2 * (p["shoulder_half_width"] + p["arm_radius"][0] * 1.5)


def on_screen(height_units: float, game: dict) -> float:
    """How many game pixels high something upright is on the screen, seen from the game's camera."""
    sprite = game["sprite"]
    return (
        height_units
        * math.cos(math.radians(sprite["camera_elevation_deg"]))
        * sprite["pixels_per_unit"]
    )


def figure_height_px(race: dict, unit: dict, game: dict) -> float:
    """The height the standard gives a figure, in game pixels."""
    standard = game["scale"]
    size_class = unit.get("size_class")
    if size_class not in standard["figure_height"]:
        known = ", ".join(sorted(standard["figure_height"]))
        raise SystemExit(f"Unit {unit['name']!r} needs a size_class, one of: {known}")
    stature = race.get("stature", 1.0)
    low, high = standard["stature_range"]
    if not low <= stature <= high:
        raise SystemExit(f"Race {race['name']!r}: stature {stature} is outside {low}-{high}")
    return standard["figure_height"][size_class] * stature * game["sprite"]["tile_width"]


def figure_scale(race: dict, unit: dict, game: dict) -> float:
    """How much the figure is scaled, as a whole, to get the height of its size class."""
    scale = figure_height_px(race, unit, game) / on_screen(natural_height(race), game)
    width = natural_body_width(race) * scale * game["sprite"]["pixels_per_unit"]
    widest = game["scale"]["max_body_width"] * game["sprite"]["tile_width"]
    if width > widest + 0.5:
        raise SystemExit(
            f"{race['name']} {unit['name']}: the body is {width:.0f} pixels wide, more than the "
            f"{widest:.0f} the size standard allows. Narrow the race's shoulders or lower its stature."
        )
    return scale


def building_height_px(size_class: str, game: dict) -> float:
    """The lowest a building of a size class may be on the screen, in game pixels."""
    return game["scale"]["building_height"][size_class] * game["sprite"]["tile_width"]
