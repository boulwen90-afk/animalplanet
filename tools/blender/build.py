"""
Builds one figure and renders its preview pictures.

    tools/blender/.venv/bin/python tools/blender/build.py --race bear --unit warrior

Everything comes from the config files in races/, units/ and game.toml, so
the same configs always give the same figure.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from animations import ANIMATIONS, Context  # noqa: E402
from animations.walk import ground_share  # noqa: E402
import buildings  # noqa: E402
from lib import export  # noqa: E402
from lib.camera import make_camera, make_lights, make_shadow_catcher  # noqa: E402
from lib.atlas import write_atlas  # noqa: E402
from lib.config import load_figures, load_game, load_race, load_unit  # noqa: E402
from lib.emblem import load_emblem, rasterize  # noqa: E402
from lib.figure import build_figure  # noqa: E402
from lib.scale import figure_height_px, figure_scale, tile_side_units  # noqa: E402
from lib.skeleton import solve  # noqa: E402

REPO = Path(__file__).resolve().parent.parent.parent

# The team-coloured parts are rendered in this grey and coloured afterwards
# through the mask. A middle grey bounces about as much light as a real colour.
NEUTRAL = "#bcbcbc"
# The large previews from straight ahead: name and how far the figure is turned.
VIEWS = (("front", 0.0), ("side", 90.0), ("back", 180.0))
# The figure turned a little to its left, as it mostly appears in the game.
GAME_YAW = -35.0
# The animation sheet shows the figure walking down and to the left.
SHEET_YAW = -45.0
# The eight ways a figure can face in the game, named by where it looks on the
# screen ("s" is towards the viewer), and how far the figure is turned for each.
DIRECTIONS = (
    ("s", 0.0),
    ("se", 45.0),
    ("e", 90.0),
    ("ne", 135.0),
    ("n", 180.0),
    ("nw", 225.0),
    ("w", 270.0),
    ("sw", 315.0),
)


class Studio:
    """A scene with one figure, its lights and a ground for its shadow."""

    def __init__(self, race: dict, unit: dict, game: dict, scratch: Path) -> None:
        self.game = game
        self.scratch = scratch
        self.scene = export.new_scene(game["preview"]["samples"])
        make_lights(self.scene, game["lighting"])
        self.figure = build_figure(
            race,
            unit,
            NEUTRAL,
            game.get("style"),
            game["emblem"]["color"],
            figure_scale(race, unit, game),
        )
        self.ground = make_shadow_catcher(self.scene)
        self.camera = None
        self._actions: dict[str, object] = {}
        self.unit = unit

        # Parts that are only in the picture some of the time.
        parts = self.figure.parts
        named = lambda prefix: [part for part in parts if part.name.startswith(prefix)]  # noqa: E731
        # Layers: drawn by the game on top of the figure, each as pictures of its own.
        self.layers = {layer["name"]: named(layer["parts"]) for layer in unit.get("layer", [])}
        for name, found in self.layers.items():
            if not found:
                raise SystemExit(f"Layer {name!r} of unit {unit['name']!r} matches no parts")
        layered = {part.name for found in self.layers.values() for part in found}
        # The weapon and the other tools: one is held at a time, by animation.
        self._weapon = named("weapon.")
        self._tools = {tool["name"]: named(f"tool.{tool['name']}.") for tool in unit.get("tool", [])}
        held = {part.name for part in self._weapon} | {
            part.name for found in self._tools.values() for part in found
        }
        self._fixed = [part for part in parts if part.name not in layered | held]
        for name in layered:
            bpy.data.objects[name].hide_render = True
        self.shown = list(parts)
        self.hold(None)

        # The gait fitted to the unit's speed: how long each foot is on the ground.
        self.ground_share = None
        self.loops_per_second = None
        speed = unit.get("movement", {}).get("speed")
        if speed is not None:
            p = race["proportions"]
            own_speed = speed * tile_side_units(game) / self.figure.scale
            self.ground_share, self.loops_per_second = ground_share(
                p["thigh"] + p["shin"], own_speed, tuple(game["gait"]["loops_per_second"])
            )
        # How many pictures had the figure cut off by the edge of the frame.
        self.clipped = 0

    def aim(self, elevation_deg: float, view_width: float) -> None:
        if self.camera is not None:
            self.scene.collection.objects.unlink(self.camera)
        self.camera = make_camera(
            self.scene, elevation_deg, view_width, self.game["sprite"]["target_z"]
        )

    def context(self) -> Context:
        figure = self.figure
        return Context(figure.stance, figure.race["proportions"], figure.rig.rest, self.ground_share)

    def hold(self, animation: str | None) -> None:
        """
        Shows what the figure holds in an animation: its weapon, unless the
        unit's config hides it there, or the tool that is shown in it. With no
        animation it holds its weapon.
        """
        weapon = self.unit.get("weapon") or {}
        shown = list(self._fixed)
        show_weapon = animation not in weapon.get("hidden_in", [])
        for part in self._weapon:
            part.hide_render = not show_weapon
        if show_weapon:
            shown += self._weapon
        for tool in self.unit.get("tool", []):
            show = animation in tool.get("shown_in", [])
            for part in self._tools[tool["name"]]:
                part.hide_render = not show
            if show:
                shown += self._tools[tool["name"]]
        # The parts that are in the figure's picture right now.
        self.shown = shown

    def animate(self, name: str, index: int) -> None:
        """Puts the figure in one frame of an animation from the shared library."""
        figure = self.figure
        self.hold(name)
        if name not in self._actions:
            animation = ANIMATIONS[name]
            proportions = figure.race["proportions"]
            context = self.context()
            poses = [
                solve(proportions, animation.pose(animation.phase(i), context), figure.rig.rest)
                for i in range(animation.frames)
            ]
            self._actions[name] = figure.rig.bake(name, poses)
        figure.rig.play(self._actions[name], index)

    def shoot(self, yaw_deg: float, size: int, shadow: bool):
        """The figure turned `yaw_deg`, as (figure, mask, shadow) pictures."""
        self.figure.rig.face(yaw_deg)
        return export.render_passes(
            self.scene, self.shown, self.ground, self.scratch, size, size, shadow
        )

    def layer_sprites(self, scale: int) -> dict[str, np.ndarray]:
        """
        Each layer as a picture to draw on top of the figure's, for the pose
        and the direction of the latest `sprite`.
        """
        size = self.game["sprite"]["frame"] * scale
        return {
            name: export.render_layer(self.scene, parts, self.shown, self.scratch, size, size)
            for name, parts in self.layers.items()
        }

    def sprite(self, yaw_deg: float, shadow: bool = True, scale: int | None = None):
        """
        One picture of the figure with its outline, as (base, mask),
        `render_scale` times game size. The previews put the figure on the
        shadow it casts. The pictures for the game leave the shadow out: the
        game draws its own under each unit, which keeps the atlas small.
        """
        sprite = self.game["sprite"]
        scale = scale or sprite["render_scale"]
        figure, mask, shade = self.shoot(yaw_deg, sprite["frame"] * scale, shadow)
        edge = np.concatenate([figure[0, :, 3], figure[-1, :, 3], figure[:, 0, 3], figure[:, -1, 3]])
        if edge.max() > 0.05:
            self.clipped += 1
        outlined = export.add_outline(
            figure, sprite["outline"], sprite["outline_strength"], sprite["outline_radius"] * scale
        )
        if not shadow:
            return outlined, mask
        return export.with_shadow(outlined, shade, sprite["shadow"], sprite["shadow_strength"]), mask


def export_sprites(race: dict, unit: dict, game: dict, out: Path) -> None:
    """Renders every animation of a unit in eight directions and writes the atlas the game loads."""
    sprite = game["sprite"]
    name = f"{race['name']}_{unit['name']}"
    out.mkdir(parents=True, exist_ok=True)
    studio = Studio(race, unit, game, out / ".render.png")
    studio.scene.cycles.samples = sprite["samples"]
    studio.aim(sprite["camera_elevation_deg"], sprite["frame"] / sprite["pixels_per_unit"])

    frames = []
    animations = {}
    for animation_name in unit["animations"]["list"]:
        animation = ANIMATIONS[animation_name]
        animations[animation_name] = {
            "frames": animation.frames,
            "fps": animation.fps,
            "loop": animation.loop,
        }
        if animation.distance:
            # How many tiles the unit moves while the loop plays once without its feet sliding.
            travelled = animation.distance(studio.context()) * studio.figure.scale
            animations[animation_name]["distance"] = round(travelled / tile_side_units(game), 4)
            if studio.loops_per_second is not None:
                # How many loops a second the legs make at the unit's speed.
                animations[animation_name]["loopsPerSecond"] = round(studio.loops_per_second, 3)
            check_feet(animation, studio)
        for direction, yaw in DIRECTIONS:
            for index in range(animation.frames):
                studio.animate(animation_name, index)
                base, mask = studio.sprite(yaw, shadow=False, scale=sprite["atlas_scale"])
                frame_name = f"{animation_name}_{direction}_{index}"
                frames.append((frame_name, base, mask))
                for layer, picture in studio.layer_sprites(sprite["atlas_scale"]).items():
                    frames.append((f"{layer}.{frame_name}", picture, np.zeros_like(picture)))
        print(f"  {name}: rendered {animation_name}", flush=True)

    (out / ".render.png").unlink(missing_ok=True)
    if studio.clipped:
        raise SystemExit(
            f"{studio.clipped} pictures of {name} were cut off by the edge of the frame; "
            "raise sprite.frame in game.toml"
        )

    scale = sprite["atlas_scale"]
    size = sprite["frame"] * scale
    feet = export.feet_offset(
        sprite["camera_elevation_deg"], sprite["target_z"], sprite["pixels_per_unit"] * scale
    )
    document = write_atlas(
        out,
        name,
        frames,
        anchor=(0.5, round((size / 2 + feet) / size, 4)),
        meta={
            "scale": scale,
            "pixelsPerUnit": sprite["pixels_per_unit"],
            "figure": {
                "sizeClass": unit["size_class"],
                # From the ground to the top of the head, in game pixels.
                "height": round(figure_height_px(race, unit, game), 2),
                "scale": round(studio.figure.scale, 4),
                # The speed the gait was fitted to, in tiles a second. It must be the unit's speed in the game.
                **({"speed": unit["movement"]["speed"]} if "movement" in unit else {}),
            },
            "loopsPerSecondRange": game["gait"]["loops_per_second"],
            "layers": list(studio.layers),
            "neutral": NEUTRAL,
            "directions": [direction for direction, _ in DIRECTIONS],
            "animations": animations,
        },
    )
    width, height = document["meta"]["size"]["w"], document["meta"]["size"]["h"]
    print(f"Wrote {len(frames)} pictures to {out} ({width} x {height} pixels)")


def check_feet(animation, studio: Studio) -> None:
    """
    Makes sure the feet do not slide in an animation of moving along the
    ground: while a foot is down, it must stay on one spot of the ground as
    the body travels `distance` per loop.
    """
    figure = studio.figure
    context = studio.context()
    proportions = figure.race["proportions"]
    travelled = animation.distance(context)
    for side in ("l", "r"):
        # Each foot stands at its own height in the stance, and that is its ground.
        ground_z = figure.rig.rest.joints[f"foot_{side}"].z
        spots = []
        for i in range(200):
            phase = i / 200
            foot = solve(proportions, animation.pose(phase, context), figure.rig.rest).joints[f"foot_{side}"]
            if foot.z <= ground_z + 1e-6:
                # Forward is -Y: after `phase` of a loop the body is this far ahead.
                at = foot.y - phase * travelled
                # The loop repeats, so the same footprint comes back one loop's travel further on.
                spots.append(at % travelled)
        if not spots:
            raise SystemExit(f"{animation.name}: the {side} foot never touches the ground")
        spread = max(spots) - min(spots)
        if spread > 0.01 and travelled - spread > 0.01:
            raise SystemExit(
                f"{animation.name}: the {side} foot slides {spread:.3f} units while it is on the ground"
            )


def render_animation_sheet(race: dict, unit: dict, game: dict, out: Path) -> None:
    """Every animation the unit uses as a row of frames, to look at the motion."""
    out.mkdir(parents=True, exist_ok=True)
    studio = Studio(race, unit, game, out / ".render.png")
    sprite = game["sprite"]
    studio.scene.cycles.samples = sprite["samples"]
    studio.aim(sprite["camera_elevation_deg"], sprite["frame"] / sprite["pixels_per_unit"])
    first = next(iter(game["teams"].values()))
    listed = {name: ANIMATIONS[name] for name in unit["animations"]["list"]}
    width = max(animation.frames for animation in listed.values())
    rows = []
    for name, animation in listed.items():
        cells = []
        for index in range(animation.frames):
            studio.animate(name, index)
            base, mask = studio.sprite(SHEET_YAW, scale=sprite["atlas_scale"])
            cells.append(
                export.on_background(export.recolor(base, mask, first, NEUTRAL), game["preview"]["background"])
            )
        blank = export.flat(cells[0].shape[1], cells[0].shape[0], "#20262c")
        rows.append(np.concatenate(cells + [blank] * (width - len(cells)), axis=1))
    export.write_png(out / "animations.png", np.concatenate(rows, axis=0))
    (out / ".render.png").unlink(missing_ok=True)
    print(f"Wrote animation sheet to {out}")


def render_previews(race: dict, unit: dict, game: dict, out: Path) -> None:
    sprite, preview, teams = game["sprite"], game["preview"], game["teams"]
    out.mkdir(parents=True, exist_ok=True)
    scratch = out / ".render.png"
    studio = Studio(race, unit, game, scratch)
    studio.figure.rig.stand()
    size, background = preview["size"], preview["background"]
    elevation = sprite["camera_elevation_deg"]
    large: dict[str, np.ndarray] = {}

    # Large pictures from the front, the side and the back, in the first team colour.
    first = next(iter(teams.values()))
    studio.aim(0.0, preview["view_width"])
    for name, yaw in VIEWS:
        figure, mask, _ = studio.shoot(yaw, size, shadow=False)
        large[name] = export.on_background(export.recolor(figure, mask, first, NEUTRAL), background)
        export.write_png(out / f"{name}.png", large[name])

    # Large pictures at the game's camera angle: one render, coloured through the mask.
    studio.aim(elevation, preview["view_width"])
    figure, mask, shadow = studio.shoot(GAME_YAW, size, shadow=True)

    def on_grass(picture: np.ndarray) -> np.ndarray:
        grounded = export.with_shadow(picture, shadow, sprite["shadow"], sprite["shadow_strength"])
        return export.on_background(grounded, background)

    for team, color in teams.items():
        large[f"game_{team}"] = on_grass(export.recolor(figure, mask, color, NEUTRAL))
        export.write_png(out / f"game_{team}.png", large[f"game_{team}"])

    # The figure with each of its layers on: a worker with its basket empty and filled.
    if studio.layers:
        cells = []
        for yaw in (GAME_YAW, 180.0 + GAME_YAW):
            plain, plain_mask, _ = studio.shoot(yaw, size, shadow=False)
            colored = export.recolor(plain, plain_mask, first, NEUTRAL)
            cells.append(export.on_background(colored, background))
            for parts in studio.layers.values():
                layer = export.render_layer(studio.scene, parts, studio.shown, scratch, size, size)
                filled = colored.copy()
                export.over(filled, layer, 0, 0)
                cells.append(export.on_background(filled, background))
        # Only the middle of each picture, where the figure is, so that the load is easy to see.
        top, bottom, side = size * 15 // 64, size * 9 // 64, size * 12 // 64
        cells = [cell[top : size - bottom, side : size - side] for cell in cells]
        columns = 1 + len(studio.layers)
        rows = [np.concatenate(cells[i : i + columns], axis=1) for i in range(0, len(cells), columns)]
        export.write_png(out / "layers.png", np.concatenate(rows, axis=0))

    # How the mask works: the white render, the mask, and four colours made from them.
    demo = [on_grass(figure), export.on_background(mask, "#20262c")]
    for color in list(teams.values()) + list(game.get("demo_teams", {}).values()):
        demo.append(on_grass(export.recolor(figure, mask, color, NEUTRAL)))
    rows = [np.concatenate(demo[i : i + 3], axis=1) for i in range(0, len(demo), 3)]
    export.write_png(out / "mask_demo.png", np.concatenate(rows, axis=0))

    # The figure as the game gets it, standing on the game's ground.
    studio.scene.cycles.samples = sprite["samples"]
    scale, frame = sprite["render_scale"], sprite["frame"]
    studio.aim(elevation, frame / sprite["pixels_per_unit"])
    tile_w, tile_h = sprite["tile_width"] * scale, sprite["tile_height"] * scale
    ground = export.iso_ground(tile_w * 6, tile_h * 8, tile_w, tile_h, background, preview["ground_edge"])
    feet = export.feet_offset(elevation, sprite["target_z"], sprite["pixels_per_unit"] * scale)
    # Tile centres as (column, row) in half tiles, and the way the figure faces.
    places = {
        "blue": [(3, 5, -35.0), (5, 9, 35.0), (2, 12, 180.0)],
        "red": [(8, 6, 35.0), (10, 10, -35.0), (7, 13, 145.0)],
    }
    shots = sorted(
        ((row, column, yaw, team) for team, spots in places.items() for column, row, yaw in spots)
    )
    sample = None
    for row, column, yaw, team in shots:
        base, mask = studio.sprite(yaw)
        if sample is None:
            sample = (base, mask)
        colored = export.recolor(base, mask, teams[team], NEUTRAL)
        x, y = column * tile_w // 2, row * tile_h // 2
        size_px = frame * scale
        export.over(ground, colored, x - size_px // 2, round(y - size_px / 2 - feet))
    export.write_png(out / "ingame_2x.png", ground)
    export.write_png(out / "ingame_1x.png", export.halve(ground))
    # One picture exactly as the game will get it: the base and its mask.
    export.write_png(out / "sprite_base.png", sample[0])
    export.write_png(out / "sprite_mask.png", sample[1])

    # One sheet with everything, for a quick look.
    top = np.concatenate([large["front"], large["side"], large["back"]], axis=1)
    bottom = np.concatenate(
        [large["game_blue"], large["game_red"], fit_square(ground, size)], axis=1
    )
    export.write_png(out / "overview.png", np.concatenate([top, bottom], axis=0))

    scratch.unlink(missing_ok=True)
    print(f"Wrote previews to {out}")


def render_overview(game: dict, out: Path) -> None:
    """
    Every figure and building in figures.toml on the game's ground, in true
    scale to each other and to the tiles: the buildings in a row at the back,
    the figures in both team colours in front. Enlarged on top, and in the
    game's own pixels below.
    """
    out.mkdir(parents=True, exist_ok=True)
    sprite, preview, teams = game["sprite"], game["preview"], game["teams"]
    scale = game["overview"]["scale"]
    elevation = sprite["camera_elevation_deg"]
    tile_w, tile_h = sprite["tile_width"] * scale, sprite["tile_height"] * scale
    size = sprite["frame"] * scale
    feet = export.feet_offset(elevation, sprite["target_z"], sprite["pixels_per_unit"] * scale)
    # Each figure stands twice, once per team, turned a little to each side.
    poses = list(zip(teams.items(), (GAME_YAW, -GAME_YAW)))

    shots = []
    for entry in load_figures():
        race, unit = load_race(entry["race"]), load_unit(entry["unit"])
        scratch = out / ".render.png"
        studio = Studio(race, unit, game, scratch)
        studio.figure.rig.stand()
        studio.scene.cycles.samples = sprite["samples"]
        studio.aim(elevation, sprite["frame"] / sprite["pixels_per_unit"])
        for (_, color), yaw in poses:
            base, mask = studio.sprite(yaw, scale=scale)
            shots.append(export.recolor(base, mask, color, NEUTRAL))
        scratch.unlink(missing_ok=True)
        print(f"  overview: rendered {race['name']} {unit['name']}", flush=True)
    structures = buildings.overview_pictures(game, out, NEUTRAL, scale)

    # Places are counted in half tiles: (column, row) is the middle of a tile
    # when their sum is odd and a corner where four tiles meet when it is even.
    # A building's middle is a tile's middle if its side is odd, else a corner.
    places = []
    column = 1
    for shot in structures:
        n = shot["footprint"]
        column += n
        places.append(column)
        column += n + 1
    half_w, half_h = tile_w // 2, tile_h // 2
    tallest = max((shot["size"] for shot in structures), default=0)
    back_row = math.ceil(tallest * 0.62 / half_h) if structures else 0
    front_row = back_row + (max((shot["footprint"] for shot in structures), default=0) + 5 if structures else 7)
    columns = max(column, 4 * len(shots) + 2)
    # The figures are spread over the width of the row of buildings.
    spread = max(4, (columns - 2) // max(1, len(shots)) // 2 * 2)
    ground = buildings.tiled_ground(
        columns * half_w, (front_row + 2) * half_h, tile_w, tile_h, preview["background"], preview["ground_edge"]
    )
    for shot, k in zip(structures, places):
        n = shot["footprint"]
        j = back_row if (k + back_row) % 2 == n % 2 else back_row + 1
        x, y = k * half_w, j * half_h
        export.over(ground, shot["picture"], round(x - shot["size"] / 2), round(y - shot["size"] / 2 - shot["feet"]))
    # The figures stand on the middles of tiles in one row in front, two tiles apart.
    for index, shot in enumerate(shots):
        k = 2 + spread // 2 + spread * index
        j = front_row if (k + front_row) % 2 == 1 else front_row + 1
        export.over(ground, shot, k * half_w - size // 2, round(j * half_h - size / 2 - feet))

    # The same picture in the game's own pixels, centred on a dark band.
    small = ground
    for _ in range(int(math.log2(scale))):
        small = export.halve(small)
    band = export.flat(ground.shape[1], small.shape[0] + 32, "#20262c")
    export.over(band, small, (band.shape[1] - small.shape[1]) // 2, 16)
    export.write_png(out / "overview.png", np.concatenate([ground, band], axis=0))
    print(
        f"Wrote the overview of {len(shots) // len(poses)} figures and {len(structures)} buildings "
        f"to {out / 'overview.png'}"
    )


def fit_square(pixels: np.ndarray, size: int) -> np.ndarray:
    """Centres a picture in a square of `size` pixels, cropping what does not fit."""
    canvas = export.flat(size, size, "#20262c")
    height, width = min(size, pixels.shape[0]), min(size, pixels.shape[1])
    top, left = (size - height) // 2, (size - width) // 2
    src_top, src_left = (pixels.shape[0] - height) // 2, (pixels.shape[1] - width) // 2
    canvas[top : top + height, left : left + width] = pixels[
        src_top : src_top + height, src_left : src_left + width
    ]
    return canvas


def check_mask(race: dict, unit: dict, game: dict, out: Path) -> None:
    """Compares colouring through the mask with rendering the colour directly."""
    out.mkdir(parents=True, exist_ok=True)
    scratch = out / ".render.png"
    studio = Studio(race, unit, game, scratch)
    size = game["preview"]["size"]
    studio.aim(game["sprite"]["camera_elevation_deg"], game["preview"]["view_width"])
    figure, mask, _ = studio.shoot(GAME_YAW, size, shadow=False)
    for team, color in game["teams"].items():
        export.set_team_color(color)
        direct = export.render(studio.scene, scratch, size, size)
        export.set_team_color(NEUTRAL)
        masked = export.recolor(figure, mask, color, NEUTRAL)
        team_pixels = mask[..., 3] > 0.5
        difference = np.abs(direct[..., :3] - masked[..., :3])[team_pixels]
        print(
            f"{team}: mean difference {difference.mean() * 255:.1f} of 255, "
            f"largest {difference.max() * 255:.0f}, over {team_pixels.sum()} team pixels"
        )
    scratch.unlink(missing_ok=True)


def render_emblems(game: dict, out: Path) -> None:
    """Flat pictures of every race's sigil on a round field, one per team colour."""
    out.mkdir(parents=True, exist_ok=True)
    size, charge = 384, game["emblem"]["color"]
    rows = []
    for color in game["teams"].values():
        row = []
        for name in game["emblem"]["races"]:
            picture = rasterize(load_emblem(name), size, color, charge, "#2a3038")
            row.append(export.on_background(picture, "#20262c"))
        rows.append(np.concatenate(row, axis=1))
    first = next(iter(game["teams"].values()))
    for name in game["emblem"]["races"]:
        export.write_png(out / f"{name}.png", rasterize(load_emblem(name), size, first, charge, "#2a3038"))
    export.write_png(out / "all.png", np.concatenate(rows, axis=0))
    print(f"Wrote sigils to {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a figure and render its previews.")
    parser.add_argument("--race", help="name of a file in races/, e.g. bear")
    parser.add_argument("--unit", help="name of a file in units/, e.g. warrior")
    parser.add_argument(
        "--emblems",
        action="store_true",
        help="draw every race's sigil to assets/previews/emblems instead of building a figure",
    )
    parser.add_argument("--out", help="folder for the previews (default: assets/previews/<race>_<unit>)")
    parser.add_argument(
        "--sprites",
        action="store_true",
        help="render the unit's animations in eight directions to assets/characters",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="build the sprites of every figure listed in figures.toml",
    )
    parser.add_argument(
        "--building",
        help="name of a building in buildings/<race>/, e.g. main: render its previews, or with --sprites its atlas",
    )
    parser.add_argument(
        "--overview",
        action="store_true",
        help="draw every figure in figures.toml side by side in true scale to assets/previews/overview.png",
    )
    parser.add_argument(
        "--animations",
        action="store_true",
        help="render every animation in the library as rows of frames",
    )
    parser.add_argument(
        "--check-mask",
        action="store_true",
        help="compare colouring through the mask with rendering each team colour directly",
    )
    args = parser.parse_args()

    game = load_game()
    if args.emblems:
        render_emblems(game, Path(args.out) if args.out else REPO / "assets" / "previews" / "emblems")
        return
    if args.overview:
        render_overview(game, Path(args.out) if args.out else REPO / "assets" / "previews")
        return
    characters = REPO / "assets" / "characters"
    structures = REPO / "assets" / "buildings"
    if args.all:
        for figure in load_figures():
            name = f"{figure['race']}_{figure['unit']}"
            export_sprites(load_race(figure["race"]), load_unit(figure["unit"]), game, characters / name)
        for entry in buildings.load_buildings():
            name = f"{entry['race']}_{entry['building']}"
            building = buildings.load_building(entry["race"], entry["building"])
            buildings.export_building(load_race(entry["race"]), building, game, structures / name, NEUTRAL)
        return
    if args.building:
        if not args.race:
            parser.error("--building needs --race")
        race, building = load_race(args.race), buildings.load_building(args.race, args.building)
        name = f"{args.race}_{args.building}"
        if args.sprites:
            buildings.export_building(race, building, game, Path(args.out) if args.out else structures / name, NEUTRAL)
        else:
            previews = Path(args.out) if args.out else REPO / "assets" / "previews" / name
            buildings.render_building_previews(race, building, game, previews, NEUTRAL)
        return
    if not args.race or not args.unit:
        parser.error("--race and --unit are required unless --emblems, --overview or --all is given")
    race, unit = load_race(args.race), load_unit(args.unit)
    out = Path(args.out) if args.out else REPO / "assets" / "previews" / f"{args.race}_{args.unit}"
    if args.sprites:
        export_sprites(race, unit, game, Path(args.out) if args.out else characters / f"{args.race}_{args.unit}")
    elif args.animations:
        render_animation_sheet(race, unit, game, out)
    elif args.check_mask:
        check_mask(race, unit, game, out)
    else:
        render_previews(race, unit, game, out)


if __name__ == "__main__":
    main()
