"""
Builds and renders buildings. A building has no skeleton and does not move,
so it does not go through the figure code: it is put together from the parts
in lib/structures.py, as listed in its config under buildings/<race>/, and
rendered once per stage with the same camera, light, outline and team-colour
mask as the figures.
"""

import math
import tomllib
from pathlib import Path

import bpy
import numpy as np

from lib import export
from lib.atlas import write_atlas
from lib.camera import make_camera, make_lights, make_shadow_catcher
from lib.emblem import load_emblem
from lib.materials import Palette
from lib.mesh import Builder
from lib.scale import building_height_px, on_screen, tile_side_units
from lib.structures import STAGES, build_structure

ROOT = Path(__file__).resolve().parent
# Colour names that get a metal material.
METALS = ("iron",)
# Parts that stand on top of a building and do not count towards its height.
NOT_ROOF = ("pennant", "banner")
# How far outside its footprint a building may reach, in tiles: eaves and log ends.
OVERHANG = 0.12


def _load(path: Path) -> dict:
    if not path.is_file():
        raise SystemExit(f"Config file not found: {path}")
    with path.open("rb") as handle:
        return tomllib.load(handle)


def load_building(race: str, name: str) -> dict:
    """A building's config, with the colours of its race's building style filled in."""
    building = _load(ROOT / "buildings" / race / f"{name}.toml")
    style = _load(ROOT / "buildings" / race / "style.toml")
    building["colors"] = {**style["colors"], **building.get("colors", {})}
    building["race"] = race
    return building


def load_buildings() -> list[dict]:
    """The buildings the game uses, as pairs of race and building names (figures.toml)."""
    return _load(ROOT / "figures.toml").get("building", [])


def tiled_ground(width: int, height: int, tile_w: int, tile_h: int, fill: str, edge: str) -> np.ndarray:
    """The game's ground at any size: one tile's worth of the pattern, repeated."""
    period = export.iso_ground(tile_w, tile_h, tile_w, tile_h, fill, edge)
    across, down = math.ceil(width / tile_w), math.ceil(height / tile_h)
    return np.tile(period, (down, across, 1))[:height, :width].copy()


class StructureStudio:
    """A scene with one building, the lights and a ground for its shadow."""

    def __init__(self, race: dict, building: dict, game: dict, scratch: Path, neutral: str) -> None:
        self.game, self.building, self.scratch = game, building, scratch
        self.scene = export.new_scene(game["sprite"]["samples"])
        make_lights(self.scene, game["lighting"])
        palette = Palette(neutral)
        palette.add_all(building["colors"], metal=METALS)
        palette.add("emblem", game["emblem"]["color"])
        emblem = load_emblem(race["emblem"]) if race.get("emblem") else None
        self.name = f"{race['name']}_{building['name']}"
        builder = Builder(self.name, None)
        self.by_stage = build_structure(builder, palette, building, emblem)
        self.parts = builder.parts

        # The config is in tiles, with x along the game's tile x axis. Seen from
        # the camera that axis runs down to the right, so the building is turned
        # an eighth of a turn and scaled to the size of a tile.
        side = tile_side_units(game)
        builder.root.rotation_euler = (0.0, 0.0, -math.pi / 4)
        builder.root.scale = (side, side, side)
        self.ground = make_shadow_catcher(self.scene)
        for part in self.parts:
            part.hide_render = True
        self.camera = None
        self.clipped = 0

        self.footprint = building["footprint"]
        self._check(side)
        sprite = game["sprite"]
        # One picture of a building: its footprint and room around it for eaves, banners and shadow.
        self.frame = self.footprint * sprite["tile_width"] + 128
        # The camera looks at the middle of what the picture holds, from the
        # front corner of the footprint to the top of the tallest part.
        low = self.footprint * sprite["tile_height"] / 2
        per_unit = on_screen(1.0, game)
        self.target_z = (self.top_px - low) / 2 / per_unit

    def _check(self, side: float) -> None:
        """The size standard: tall enough for its class, and inside its footprint."""
        building, game = self.building, self.game
        bpy.context.view_layer.update()
        top = roof = reach = 0.0
        for part in self.by_stage["complete"]:
            corners = [part.matrix_local @ _vector(corner) for corner in part.bound_box]
            high = max(corner.z for corner in corners)
            top = max(top, high)
            if not any(f"_{kind}." in part.name for kind in NOT_ROOF):
                roof = max(roof, high)
            reach = max(reach, max(max(abs(corner.x), abs(corner.y)) for corner in corners))
        # In game pixels on the screen, from the ground.
        self.top_px = on_screen(top * side, game)
        self.roof_px = on_screen(roof * side, game)
        lowest = building_height_px(building["size_class"], game)
        if self.roof_px < lowest:
            raise SystemExit(
                f"{self.name}: the roof is {self.roof_px:.0f} pixels high, less than the {lowest:.0f} "
                f"the size standard asks of a {building['size_class']!r} building."
            )
        if reach > self.footprint / 2 + OVERHANG:
            raise SystemExit(
                f"{self.name}: a part reaches {reach:.2f} tiles from the middle, outside the "
                f"footprint of {self.footprint} tiles (at most {self.footprint / 2 + OVERHANG:.2f})."
            )

    def aim(self) -> None:
        if self.camera is not None:
            self.scene.collection.objects.unlink(self.camera)
        sprite = self.game["sprite"]
        self.camera = make_camera(
            self.scene,
            sprite["camera_elevation_deg"],
            self.frame / sprite["pixels_per_unit"],
            self.target_z,
        )

    def show(self, stage: str) -> list:
        shown = self.by_stage[stage]
        names = {part.name for part in shown}
        for part in self.parts:
            part.hide_render = part.name not in names
        return shown

    def sprite(self, stage: str, scale: int):
        """One stage of the building, with its outline: (picture, mask, shadow alone)."""
        sprite = self.game["sprite"]
        size = self.frame * scale
        figure, mask, shade = export.render_passes(
            self.scene, self.show(stage), self.ground, self.scratch, size, size, True
        )
        edge = np.concatenate([figure[0, :, 3], figure[-1, :, 3], figure[:, 0, 3], figure[:, -1, 3]])
        if edge.max() > 0.05:
            self.clipped += 1
        outlined = export.add_outline(
            figure, sprite["outline"], sprite["outline_strength"], sprite["outline_radius"] * scale
        )
        shadow = export.with_shadow(np.zeros_like(figure), shade, sprite["shadow"], sprite["shadow_strength"])
        return outlined, mask, shadow

    def feet(self, scale: int) -> float:
        """How far below the middle of a picture the middle of the footprint is, in pixels."""
        sprite = self.game["sprite"]
        return export.feet_offset(sprite["camera_elevation_deg"], self.target_z, sprite["pixels_per_unit"] * scale)

    def place(self, canvas: np.ndarray, picture: np.ndarray, x: float, y: float, scale: int) -> None:
        """Puts a picture on a canvas with the middle of the footprint at (x, y)."""
        size = self.frame * scale
        export.over(canvas, picture, round(x - size / 2), round(y - size / 2 - self.feet(scale)))


def _vector(corner):
    from mathutils import Vector

    return Vector(corner)


def _studio(race: dict, building: dict, game: dict, out: Path, neutral: str) -> StructureStudio:
    out.mkdir(parents=True, exist_ok=True)
    studio = StructureStudio(race, building, game, out / ".render.png", neutral)
    studio.aim()
    return studio


def _fail_if_clipped(studio: StructureStudio) -> None:
    if studio.clipped:
        raise SystemExit(f"{studio.clipped} pictures of {studio.name} were cut off by the edge of the frame")


def export_building(race: dict, building: dict, game: dict, out: Path, neutral: str) -> None:
    """Renders each stage of a building and writes the atlas the game can load."""
    sprite = game["sprite"]
    scale = sprite["atlas_scale"]
    studio = _studio(race, building, game, out, neutral)
    frames = []
    for stage in STAGES:
        picture, mask, shadow = studio.sprite(stage, scale)
        frames.append((stage, picture, mask))
        if stage == "complete":
            frames.append(("shadow", shadow, np.zeros_like(shadow)))
    (out / ".render.png").unlink(missing_ok=True)
    _fail_if_clipped(studio)
    size = studio.frame * scale
    document = write_atlas(
        out,
        studio.name,
        frames,
        anchor=(0.5, round((size / 2 + studio.feet(scale)) / size, 4)),
        meta={
            "scale": scale,
            "pixelsPerUnit": sprite["pixels_per_unit"],
            "building": {
                "gameBuilding": building.get("game_building"),
                "sizeClass": building["size_class"],
                # Side of the footprint in tiles; the anchor is its middle, on the ground.
                "footprint": studio.footprint,
                # From the ground to the top of the roof, in game pixels, and the least the size standard allows.
                "roofHeight": round(studio.roof_px, 1),
                "minRoofHeight": round(building_height_px(building["size_class"], game), 1),
                # To the top of the tallest part, a banner or pennant included.
                "height": round(studio.top_px, 1),
            },
            "neutral": neutral,
            "stages": list(STAGES),
        },
    )
    width, height = document["meta"]["size"]["w"], document["meta"]["size"]["h"]
    print(f"Wrote {len(frames)} pictures of {studio.name} to {out} ({width} x {height} pixels)")


def render_building_previews(race: dict, building: dict, game: dict, out: Path, neutral: str) -> None:
    """Preview pictures of one building: its stages on the game's ground, and the finished building in each team colour."""
    sprite, preview, teams = game["sprite"], game["preview"], game["teams"]
    studio = _studio(race, building, game, out, neutral)
    first = next(iter(teams.values()))
    n = studio.footprint

    # The stages side by side, on the game's ground, twice the size of game pixels.
    scale = sprite["render_scale"]
    tile_w, tile_h = sprite["tile_width"] * scale, sprite["tile_height"] * scale
    cell = (n + 2) * tile_w
    high = (n + 1) * tile_h + round(studio.top_px * scale) + tile_h
    ground = tiled_ground(cell * len(STAGES), high, tile_w, tile_h, preview["background"], preview["ground_edge"])
    # The middle of the footprint is a tile's middle for an odd side and a corner for an even one.
    row = round((high - (n / 2 + 0.5) * tile_h) / (tile_h / 2))
    for index, stage in enumerate(STAGES):
        picture, mask, shadow = studio.sprite(stage, scale)
        column = (2 * index + 1) * (n + 2)
        if (column + row) % 2 != n % 2:
            column += 1
        x, y = column * tile_w / 2, row * tile_h / 2
        studio.place(ground, shadow, x, y, scale)
        studio.place(ground, export.recolor(picture, mask, first, neutral), x, y, scale)
    export.write_png(out / "stages.png", ground)

    # The finished building, large, in each team colour.
    large = preview.get("building_scale", 3)
    picture, mask, shadow = studio.sprite("complete", large)
    cells = []
    for color in teams.values():
        canvas = export.flat(studio.frame * large, studio.frame * large, preview["background"])
        export.over(canvas, shadow, 0, 0)
        export.over(canvas, export.recolor(picture, mask, color, neutral), 0, 0)
        cells.append(canvas)
    export.write_png(out / "teams.png", np.concatenate(cells, axis=1))
    (out / ".render.png").unlink(missing_ok=True)
    _fail_if_clipped(studio)
    print(
        f"Wrote previews of {studio.name} to {out}: roof {studio.roof_px:.0f} px, "
        f"with banners {studio.top_px:.0f} px"
    )


def overview_pictures(game: dict, out: Path, neutral: str, scale: int) -> list[dict]:
    """Every building in figures.toml, finished, for the overview: picture with shadow, and how to place it."""
    teams = list(game["teams"].values())
    shots = []
    for index, entry in enumerate(load_buildings()):
        from lib.config import load_race

        race, building = load_race(entry["race"]), load_building(entry["race"], entry["building"])
        studio = _studio(race, building, game, out, neutral)
        picture, mask, shadow = studio.sprite("complete", scale)
        (out / ".render.png").unlink(missing_ok=True)
        _fail_if_clipped(studio)
        size = studio.frame * scale
        canvas = np.zeros((size, size, 4), dtype=np.float32)
        export.over(canvas, shadow, 0, 0)
        export.over(canvas, export.recolor(picture, mask, teams[index % len(teams)], neutral), 0, 0)
        shots.append({"picture": canvas, "size": size, "feet": studio.feet(scale), "footprint": studio.footprint})
        print(f"  overview: rendered {studio.name}", flush=True)
    return shots
