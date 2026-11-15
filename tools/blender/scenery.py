"""
Builds and renders the scenery: the trees, bushes, rocks and caves that stand
on the ground, and the ground's water and shore. Everything goes into one
atlas. The things that stand are put together from the parts in
lib/nature.py and rendered with the same camera, light and outline as the
buildings; the water and the shore are drawn by lib/ground.py.
"""

import math
import tomllib
from pathlib import Path

import bpy
import numpy as np

from lib import export, ground
from lib.atlas import write_atlas
from lib.camera import make_camera, make_lights, make_shadow_catcher
from lib.materials import Palette
from lib.mesh import Builder
from lib.nature import PARTS
from lib.scale import on_screen, tile_side_units

ROOT = Path(__file__).resolve().parent
# How far below the middle of a picture the middle of the tile is, in game pixels.
FEET = 40


def load_scenery() -> dict:
    with (ROOT / "scenery" / "scenery.toml").open("rb") as handle:
        return tomllib.load(handle)


class SceneryStudio:
    """A scene with every item, of which one is shown at a time."""

    def __init__(self, scenery: dict, game: dict, scratch: Path, neutral: str) -> None:
        self.game, self.scenery, self.scratch = game, scenery, scratch
        sprite = game["sprite"]
        self.scene = export.new_scene(sprite["samples"])
        make_lights(self.scene, game["lighting"])
        palette = Palette(neutral)
        palette.add_all(scenery["colors"])
        builder = Builder(scenery["name"], None)
        self.items: dict[str, list] = {}
        self.kinds: dict[str, str] = {}
        # Whether each item gets its shadow on the ground and its dark outline.
        self.shadows: dict[str, bool] = {}
        self.outlines: dict[str, bool] = {}
        for item in scenery["item"]:
            before = len(builder.parts)
            for index, part in enumerate(item["part"]):
                if part["type"] not in PARTS:
                    raise SystemExit(f"Scenery item {item['name']!r}: unknown part type {part['type']!r}")
                PARTS[part["type"]](builder, palette, part, f"{item['name']}_{index:02d}")
            self.items[item["name"]] = builder.parts[before:]
            self.kinds[item["name"]] = item["kind"]
            self.shadows[item["name"]] = item.get("shadow", True)
            self.outlines[item["name"]] = item.get("outline", True)
        self.parts = builder.parts

        # As for the buildings: the config is in tiles along the game's axes.
        side = tile_side_units(game)
        builder.root.rotation_euler = (0.0, 0.0, -math.pi / 4)
        builder.root.scale = (side, side, side)
        self.ground = make_shadow_catcher(self.scene)
        for part in self.parts:
            part.hide_render = True
        # One picture: a tile and room around it for a tall tree and its shadow.
        self.frame = sprite["tile_width"] + 128
        # The camera looks at a fixed height, so that every picture has the middle of the tile at the same point.
        self.target_z = FEET / export.feet_offset(sprite["camera_elevation_deg"], 1.0, sprite["pixels_per_unit"])
        make_camera(self.scene, sprite["camera_elevation_deg"], self.frame / sprite["pixels_per_unit"], self.target_z)
        self.heights = self._check(side)
        self.clipped: list[str] = []

    def _check(self, side: float) -> dict[str, float]:
        """The size standard: each item's height on the screen is within what its kind allows."""
        bpy.context.view_layer.update()
        allowed = self.game["scale"]["scenery_height"]
        tile = self.game["sprite"]["tile_width"]
        heights = {}
        for name, parts in self.items.items():
            top = max((part.matrix_local @ _vector(corner)).z for part in parts for corner in part.bound_box)
            heights[name] = on_screen(top * side, self.game)
            low, high = allowed[self.kinds[name]]
            if not low * tile <= heights[name] <= high * tile:
                raise SystemExit(
                    f"{name}: {heights[name]:.0f} pixels high, outside the {low * tile:.0f} to {high * tile:.0f} "
                    f"the size standard allows a {self.kinds[name]}."
                )
        return heights

    @property
    def anchor(self) -> tuple[float, float]:
        """The point of every picture that stands on the middle of the tile, in pixels."""
        return self.frame / 2, self.frame / 2 + FEET

    def sprite(self, name: str, scale: int):
        """One item with its outline and its shadow on the ground: (picture, mask)."""
        sprite = self.game["sprite"]
        shown = {part.name for part in self.items[name]}
        for part in self.parts:
            part.hide_render = part.name not in shown
        size = self.frame * scale
        figure, mask, shade = export.render_passes(self.scene, self.items[name], self.ground, self.scratch, size, size, True)
        edge = np.concatenate([figure[0, :, 3], figure[-1, :, 3], figure[:, 0, 3], figure[:, -1, 3]])
        if edge.max() > 0.05:
            self.clipped.append(name)
        outlined = figure
        if self.outlines[name]:
            outlined = export.add_outline(figure, sprite["outline"], sprite["outline_strength"], sprite["outline_radius"] * scale)
        if not self.shadows[name]:
            return outlined, mask
        return export.with_shadow(outlined, self._near(shade, scale), sprite["shadow"], sprite["shadow_strength"]), mask

    def _near(self, shade: np.ndarray, scale: int) -> np.ndarray:
        """
        The shadow, kept only near the foot of the item. A tree's whole shadow
        is as long as the tree is tall, and would make its picture twice as
        wide: with hundreds of trees on the screen that is a great deal to
        draw for something that is hardly looked at.
        """
        reach = self.scenery.get("shadow_reach", {"across": 22, "down": 11, "soft": 8})
        ys, xs = np.mgrid[0 : shade.shape[0], 0 : shade.shape[1]].astype(np.float32)
        ax, ay = self.anchor[0] * scale, self.anchor[1] * scale
        # An ellipse round the foot, a little to the right, where the shadow falls.
        dx = (xs - ax - 5 * scale) / (reach["across"] * scale)
        dy = (ys - ay) / (reach["down"] * scale)
        distance = np.hypot(dx, dy)
        soft = reach["soft"] / reach["across"]
        keep = np.clip((1 + soft - distance) / soft, 0.0, 1.0)
        near = shade.copy()
        near[..., 3] *= keep
        return near


def _vector(corner):
    from mathutils import Vector

    return Vector(corner)


def ground_frames(scenery: dict, game: dict, frame: int, anchor: tuple[float, float]) -> dict[str, np.ndarray]:
    """The water tiles and the pieces of the shore, by frame name."""
    sprite, colors = game["sprite"], scenery["ground"]
    tile_w, tile_h = sprite["tile_width"], sprite["tile_height"]
    frames = {
        f"water_{i + 1}": ground.water_tile(frame, anchor, tile_w, tile_h, colors, i)
        for i in range(colors["water_variants"])
    }
    frames.update(ground.shore_pieces(frame, anchor, tile_w, tile_h, colors, colors["shore"]))
    return frames


def _frames(scenery: dict, game: dict, out: Path, neutral: str, scale: int):
    out.mkdir(parents=True, exist_ok=True)
    studio = SceneryStudio(scenery, game, out / ".render.png", neutral)
    frames = []
    for name in studio.items:
        picture, mask = studio.sprite(name, scale)
        frames.append((name, picture, mask))
        print(f"  scenery: rendered {name}", flush=True)
    (out / ".render.png").unlink(missing_ok=True)
    if studio.clipped:
        raise SystemExit(f"These pictures were cut off by the edge of the frame: {', '.join(studio.clipped)}")
    if scale != 1:
        raise SystemExit("The ground is drawn in game pixels: scenery needs atlas_scale = 1")
    for name, picture in ground_frames(scenery, game, studio.frame, studio.anchor).items():
        frames.append((name, picture, np.zeros_like(picture)))
    return studio, frames


def export_scenery(scenery: dict, game: dict, out: Path, neutral: str) -> None:
    """Renders every item, draws the ground, and writes the atlas the game can load."""
    sprite = game["sprite"]
    scale = sprite["atlas_scale"]
    studio, frames = _frames(scenery, game, out, neutral, scale)
    size = studio.frame * scale
    document = write_atlas(
        out,
        scenery["name"],
        frames,
        anchor=(0.5, round(studio.anchor[1] / studio.frame, 4)),
        meta={
            "scale": scale,
            "pixelsPerUnit": sprite["pixels_per_unit"],
            "neutral": neutral,
            "scenery": {
                # Every picture is this many pixels square, with the middle of its tile at the anchor.
                "frame": size,
                # What kind each standing item is, and how tall on the screen, in game pixels.
                "items": {
                    name: {"kind": studio.kinds[name], "height": round(studio.heights[name], 1)}
                    for name in studio.items
                },
                # Allowed heights by kind, in game pixels: the size standard.
                "allowed": {
                    kind: [round(low * sprite["tile_width"], 1), round(high * sprite["tile_width"], 1)]
                    for kind, (low, high) in game["scale"]["scenery_height"].items()
                },
            },
        },
    )
    width, height = document["meta"]["size"]["w"], document["meta"]["size"]["h"]
    print(f"Wrote {len(frames)} pictures of scenery to {out} ({width} x {height} pixels)")


def render_scenery_previews(scenery: dict, game: dict, out: Path, neutral: str) -> None:
    """
    Preview pictures: every item on the game's ground, and a small piece of
    map with a lake, put together by the same rules as the game uses, to
    show that the pieces of the shore fit.
    """
    from buildings import tiled_ground

    sprite, preview, teams = game["sprite"], game["preview"], game["teams"]
    studio, frames = _frames(scenery, game, out, neutral, 1)
    by_name = {name: (picture, mask) for name, picture, mask in frames}
    team = next(iter(teams.values()))
    tile_w, tile_h = sprite["tile_width"], sprite["tile_height"]
    ax, ay = studio.anchor

    def coloured(name: str) -> np.ndarray:
        picture, mask = by_name[name]
        return export.recolor(picture, mask, team, neutral)

    # 1. Every standing item in a row.
    names = list(studio.items)
    step = 100
    canvas = tiled_ground(step * len(names) + 100, 240, tile_w, tile_h, preview["background"], preview["ground_edge"])
    for i, name in enumerate(names):
        export.over(canvas, coloured(name), round(60 + step * i - ax), round(170 - ay))
    export.write_png(out / "items.png", np.repeat(np.repeat(canvas, 2, axis=0), 2, axis=1))

    # 2. A piece of map: '~' water, '.' grass, and letters for what stands on it.
    rows = [
        "..T....t....",
        ".T..~~~.....",
        "...~~~~~..R.",
        "..~~~~~~~...",
        "..~~~.~~~.b.",
        "...~~~~~....",
        ".B...~~..S..",
        "....F....T.C",
    ]
    stands = {"T": "tree_1", "t": "tree_2", "R": "rock_1", "b": "bush_few", "B": "bush_full", "S": "stump", "F": "fishing_place", "C": "cave"}
    height, width = len(rows), len(rows[0])
    is_water = lambda x, y: 0 <= x < width and 0 <= y < height and rows[y][x] == "~"  # noqa: E731
    origin_x = height * tile_w // 2 + 40
    canvas = tiled_ground((width + height) * tile_w // 2 + 80, (width + height) * tile_h // 2 + 160, tile_w, tile_h, preview["background"], preview["ground_edge"])

    def put(name: str, x: int, y: int) -> None:
        cx = origin_x + (x - y) * tile_w // 2
        cy = 100 + (x + y) * tile_h // 2 + tile_h // 2
        export.over(canvas, coloured(name), round(cx - ax), round(cy - ay))

    for y in range(height):
        for x in range(width):
            if is_water(x, y):
                put(f"water_{(x * 7 + y * 13) % 3 + 1}", x, y)
    for y in range(height):
        for x in range(width):
            if not is_water(x, y):
                continue
            land = {name: not is_water(x + sx, y + sy) for name, (sx, sy) in ground.SIDES.items()}
            for name, on_land in land.items():
                if on_land:
                    put(f"shore_{name}", x, y)
            for name, (sx, sy) in ground.CORNERS.items():
                a, b = land["x+" if sx > 0 else "x-"], land["y+" if sy > 0 else "y-"]
                if a and b:
                    put(f"shore_out_{name}", x, y)
                elif not a and not b and not is_water(x + sx, y + sy):
                    put(f"shore_in_{name}", x, y)
    # What stands on the ground, from the back of the picture to the front.
    for total in range(width + height):
        for x in range(width):
            y = total - x
            if 0 <= y < height and rows[y][x] in stands:
                put(stands[rows[y][x]], x, y)
    export.write_png(out / "map.png", np.repeat(np.repeat(canvas, 2, axis=0), 2, axis=1))
    print(f"Wrote previews of the scenery to {out}")
