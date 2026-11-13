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
from lib.camera import make_camera, make_lights  # noqa: E402
from lib.config import load_game, load_race, load_unit  # noqa: E402
from lib.figure import build_figure  # noqa: E402

REPO = Path(__file__).resolve().parent.parent.parent

# The large previews: name, how far the figure is turned, and how high the camera is.
VIEWS = (
    ("front", 0.0, 0.0),
    ("side", 90.0, 0.0),
    ("back", 180.0, 0.0),
)
# The figure turned a little to its left, as it mostly appears in the game.
GAME_YAW = -35.0


def turn(builder, yaw_deg: float) -> None:
    builder.root.rotation_euler = (0.0, 0.0, math.radians(yaw_deg))


def render_previews(race: dict, unit: dict, game: dict, out: Path) -> None:
    sprite, preview, teams = game["sprite"], game["preview"], game["teams"]
    out.mkdir(parents=True, exist_ok=True)
    scratch = out / ".render.png"

    scene = export.new_scene(preview["samples"])
    make_lights(scene, game["lighting"])
    builder = build_figure(race, unit, teams["blue"])
    size, background = preview["size"], preview["background"]
    elevation = sprite["camera_elevation_deg"]

    # Large pictures from the front, the side and the back.
    make_camera(scene, 0.0, preview["view_width"], sprite["target_z"])
    large: dict[str, np.ndarray] = {}
    for name, yaw, _ in VIEWS:
        turn(builder, yaw)
        large[name] = export.on_background(export.render(scene, scratch, size, size), background)
        export.write_png(out / f"{name}.png", large[name])

    # Large pictures at the game's camera angle, one per team colour.
    camera = make_camera(scene, elevation, preview["view_width"], sprite["target_z"])
    turn(builder, GAME_YAW)
    for team, color in teams.items():
        export.set_team_color(color)
        large[f"game_{team}"] = export.on_background(
            export.render(scene, scratch, size, size), background
        )
        export.write_png(out / f"game_{team}.png", large[f"game_{team}"])

    # The figure at the size it has in the game, standing on the game's ground.
    frame = sprite["frame"]
    camera.data.ortho_scale = frame / sprite["pixels_per_unit"]
    scene.cycles.filter_width = sprite["filter_width"]
    tile_w, tile_h = sprite["tile_width"], sprite["tile_height"]
    ground = export.iso_ground(tile_w * 5, tile_h * 6, tile_w, tile_h, background, preview["ground_edge"])
    feet = export.feet_offset(elevation, sprite["target_z"], sprite["pixels_per_unit"])
    # Tile centres, as (column, row) steps of half a tile.
    places = {
        "blue": [(2, 5, -35.0), (4, 7, 35.0), (3, 10, 180.0)],
        "red": [(6, 7, 35.0), (8, 5, -35.0), (7, 10, 145.0)],
    }
    for team, spots in places.items():
        export.set_team_color(teams[team])
        for column, row, yaw in spots:
            turn(builder, yaw)
            small = export.render(scene, scratch, frame, frame)
            small = export.add_outline(small, sprite["outline"], sprite["outline_strength"])
            x = column * tile_w // 2
            y = row * tile_h // 2
            export.over(ground, small, x - frame // 2, round(y - frame / 2 - feet))
    export.write_png(out / "ingame_1x.png", ground)
    export.write_png(out / "ingame_4x.png", export.upscale(ground, 4))

    # One sheet with everything, for a quick look.
    top = np.concatenate([large["front"], large["side"], large["back"]], axis=1)
    enlarged = export.upscale(ground, 2)
    pad = flat_pad(enlarged, size)
    bottom = np.concatenate([large["game_blue"], large["game_red"], pad], axis=1)
    export.write_png(out / "overview.png", np.concatenate([top, bottom], axis=0))

    scratch.unlink(missing_ok=True)
    print(f"Wrote previews to {out}")


def flat_pad(pixels: np.ndarray, size: int) -> np.ndarray:
    """Centres a picture in a square of `size` pixels, cropping what does not fit."""
    canvas = export.flat(size, size, "#20262c")
    height, width = min(size, pixels.shape[0]), min(size, pixels.shape[1])
    top, left = (size - height) // 2, (size - width) // 2
    src_top, src_left = (pixels.shape[0] - height) // 2, (pixels.shape[1] - width) // 2
    canvas[top : top + height, left : left + width] = pixels[
        src_top : src_top + height, src_left : src_left + width
    ]
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a figure and render its previews.")
    parser.add_argument("--race", required=True, help="name of a file in races/, e.g. bear")
    parser.add_argument("--unit", required=True, help="name of a file in units/, e.g. warrior")
    parser.add_argument("--out", help="folder for the previews (default: assets/previews/<race>_<unit>)")
    args = parser.parse_args()

    race, unit, game = load_race(args.race), load_unit(args.unit), load_game()
    out = Path(args.out) if args.out else REPO / "assets" / "previews" / f"{args.race}_{args.unit}"
    render_previews(race, unit, game, out)


if __name__ == "__main__":
    main()
