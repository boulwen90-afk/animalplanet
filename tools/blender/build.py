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

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import export  # noqa: E402
from lib.camera import make_camera, make_lights, make_shadow_catcher  # noqa: E402
from lib.config import load_game, load_race, load_unit  # noqa: E402
from lib.emblem import load_emblem, rasterize  # noqa: E402
from lib.figure import build_figure  # noqa: E402

REPO = Path(__file__).resolve().parent.parent.parent

# The team-coloured parts are rendered in this grey and coloured afterwards
# through the mask. A middle grey bounces about as much light as a real colour.
NEUTRAL = "#bcbcbc"
# The large previews from straight ahead: name and how far the figure is turned.
VIEWS = (("front", 0.0), ("side", 90.0), ("back", 180.0))
# The figure turned a little to its left, as it mostly appears in the game.
GAME_YAW = -35.0


class Studio:
    """A scene with one figure, its lights and a ground for its shadow."""

    def __init__(self, race: dict, unit: dict, game: dict, scratch: Path) -> None:
        self.game = game
        self.scratch = scratch
        self.scene = export.new_scene(game["preview"]["samples"])
        make_lights(self.scene, game["lighting"])
        self.builder = build_figure(
            race, unit, NEUTRAL, game.get("style"), game["emblem"]["color"]
        )
        self.ground = make_shadow_catcher(self.scene)
        self.camera = None

    def aim(self, elevation_deg: float, view_width: float) -> None:
        if self.camera is not None:
            self.scene.collection.objects.unlink(self.camera)
        self.camera = make_camera(
            self.scene, elevation_deg, view_width, self.game["sprite"]["target_z"]
        )

    def shoot(self, yaw_deg: float, size: int, shadow: bool):
        """The figure turned `yaw_deg`, as (figure, mask, shadow) pictures."""
        self.builder.root.rotation_euler = (0.0, 0.0, math.radians(yaw_deg))
        return export.render_passes(
            self.scene, self.builder.parts, self.ground, self.scratch, size, size, shadow
        )

    def sprite(self, yaw_deg: float):
        """One picture for the game, as (base, mask), `render_scale` times game size."""
        sprite = self.game["sprite"]
        scale = sprite["render_scale"]
        figure, mask, shadow = self.shoot(yaw_deg, sprite["frame"] * scale, True)
        outlined = export.add_outline(
            figure, sprite["outline"], sprite["outline_strength"], sprite["outline_radius"] * scale
        )
        return export.with_shadow(outlined, shadow, sprite["shadow"], sprite["shadow_strength"]), mask


def render_previews(race: dict, unit: dict, game: dict, out: Path) -> None:
    sprite, preview, teams = game["sprite"], game["preview"], game["teams"]
    out.mkdir(parents=True, exist_ok=True)
    scratch = out / ".render.png"
    studio = Studio(race, unit, game, scratch)
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
        "--check-mask",
        action="store_true",
        help="compare colouring through the mask with rendering each team colour directly",
    )
    args = parser.parse_args()

    game = load_game()
    if args.emblems:
        render_emblems(game, Path(args.out) if args.out else REPO / "assets" / "previews" / "emblems")
        return
    if not args.race or not args.unit:
        parser.error("--race and --unit are required unless --emblems is given")
    race, unit = load_race(args.race), load_unit(args.unit)
    out = Path(args.out) if args.out else REPO / "assets" / "previews" / f"{args.race}_{args.unit}"
    if args.check_mask:
        check_mask(race, unit, game, out)
    else:
        render_previews(race, unit, game, out)


if __name__ == "__main__":
    main()
