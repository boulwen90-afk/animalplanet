"""
The ground itself: water, and the shore between water and land. These are
flat, so they are drawn here pixel by pixel instead of being rendered. Every
picture is a canvas with the middle of one tile at a fixed point, like the
pictures of what stands on the ground, so the game places them the same way.

The shore is a band along the line where water meets land: shallow water,
a line of foam, wet sand, and dry sand that fades out over the grass. It is
cut into pieces that fit together: one for each side of a water tile that
has land on it, and two kinds of corner piece.
"""

import numpy as np

from .export import hex_to_rgb

FINE = 4  # every pixel is the average of this many samples each way, for smooth edges

# The four sides of a tile, as steps in tiles, and the four corners between them.
SIDES = {"x+": (1, 0), "x-": (-1, 0), "y+": (0, 1), "y-": (0, -1)}
CORNERS = {"x+y+": (1, 1), "x+y-": (1, -1), "x-y+": (-1, 1), "x-y-": (-1, -1)}


def _tile_coordinates(frame: int, anchor: tuple[float, float], tile_w: int, tile_h: int):
    """For every sample of the canvas: where it lies in tiles, measured from the middle of the tile."""
    ys, xs = (np.mgrid[0 : frame * FINE, 0 : frame * FINE].astype(np.float32) + 0.5) / FINE
    dx, dy = xs - anchor[0], ys - anchor[1]
    return (dx / tile_w + dy / tile_h), (dy / tile_h - dx / tile_w)


def _downsample(samples: np.ndarray, frame: int) -> np.ndarray:
    """Averages the samples of each pixel, weighting colour by how solid each sample is."""
    grouped = samples.reshape(frame, FINE, frame, FINE, 4)
    alpha = grouped[..., 3:4]
    total = alpha.sum(axis=(1, 3))
    colour = (grouped[..., :3] * alpha).sum(axis=(1, 3)) / np.maximum(total, 1e-6)
    return np.concatenate([colour, total / (FINE * FINE)], axis=-1).astype(np.float32)


def _over(canvas: np.ndarray, colour: np.ndarray, alpha: np.ndarray) -> None:
    """Paints a colour over the samples of a canvas, as solid as `alpha` says."""
    a = alpha[..., None]
    under = canvas[..., 3:4]
    out = a + under * (1 - a)
    canvas[..., :3] = (colour * a + canvas[..., :3] * under * (1 - a)) / np.maximum(out, 1e-6)
    canvas[..., 3:4] = out


def water_tile(frame: int, anchor, tile_w: int, tile_h: int, colors: dict, variant: int) -> np.ndarray:
    """One tile of water: a flat blue with a few paler ripples, differently placed in each variant."""
    u, v = _tile_coordinates(frame, anchor, tile_w, tile_h)
    inside = (np.abs(u) <= 0.5) & (np.abs(v) <= 0.5)
    canvas = np.zeros((frame * FINE, frame * FINE, 4), dtype=np.float32)
    _over(canvas, hex_to_rgb(colors["water"]), inside.astype(np.float32))
    # Ripples: short flat streaks, level on the screen. On the screen a step to the right is u - v.
    across, down = (u - v), (u + v)
    places = (
        ((-0.25, -0.3, 0.2), (0.3, 0.1, 0.24), (-0.1, 0.42, 0.16)),
        ((0.2, -0.35, 0.22), (-0.35, 0.05, 0.18), (0.15, 0.35, 0.2)),
        ((0.0, -0.1, 0.26), (-0.3, 0.3, 0.16), (0.38, -0.2, 0.14)),
    )[variant % 3]
    for x, y, length in places:
        streak = (np.abs(across - x) < length) & (np.abs(down - y) < 0.035) & inside
        _over(canvas, hex_to_rgb(colors["water_light"]), streak.astype(np.float32) * 0.9)
    return _downsample(canvas, frame)


def _band(canvas: np.ndarray, d: np.ndarray, where: np.ndarray, colors: dict, shore: dict) -> None:
    """
    Paints the shore where `where` holds. `d` is how far a sample is from the
    waterline, in tiles: negative out in the water, positive up on land.
    """
    shallow, foam, sand, fade = shore["shallow"], shore["foam"], shore["sand"], shore["fade"]
    region = where.astype(np.float32)
    # Shallow water: stronger towards the waterline.
    _over(canvas, hex_to_rgb(colors["water_shallow"]), region * np.clip((d + shallow) / shallow, 0.0, 1.0) * (d <= 0) * 0.85)
    # Wet sand from the waterline, then dry sand that fades out over the grass.
    on_land = d > 0
    solid = np.where(d <= sand, 1.0, np.clip(1 - (d - sand) / fade, 0.0, 1.0))
    wet = np.clip(1 - d / (sand * 0.6), 0.0, 1.0)
    colour = hex_to_rgb(colors["sand"])[None, None, :] * (1 - wet[..., None]) + hex_to_rgb(colors["sand_wet"])[None, None, :] * wet[..., None]
    _over(canvas, colour, region * on_land * solid)
    # A line of foam just outside the waterline.
    _over(canvas, hex_to_rgb(colors["foam"]), region * ((d > -foam) & (d <= 0)) * 0.9)


def shore_pieces(frame: int, anchor, tile_w: int, tile_h: int, colors: dict, shore: dict) -> dict[str, np.ndarray]:
    """
    The pieces of the shore around one water tile, by name:
    `shore_<side>` for a side with land on it; `shore_out_<corner>` for a
    corner between two such sides; `shore_in_<corner>` for a corner where
    only the tile across the corner is land.
    """
    u, v = _tile_coordinates(frame, anchor, tile_w, tile_h)
    reach = shore["sand"] + shore["fade"]
    pieces: dict[str, np.ndarray] = {}

    def piece(d: np.ndarray, where: np.ndarray) -> np.ndarray:
        canvas = np.zeros((frame * FINE, frame * FINE, 4), dtype=np.float32)
        _band(canvas, d, where & (d > -shore["shallow"]) & (d < reach), colors, shore)
        return _downsample(canvas, frame)

    for name, (sx, sy) in SIDES.items():
        # Along the side, the piece covers the tile's own length; across it, the whole band.
        along, across = (v, u * sx) if sx else (u, v * sy)
        pieces[f"shore_{name}"] = piece(across - 0.5, np.abs(along) <= 0.5)
    for name, (sx, sy) in CORNERS.items():
        cu, cv = u * sx - 0.5, v * sy - 0.5  # measured from the corner, positive towards the tile across it
        distance = np.hypot(cu, cv)
        pieces[f"shore_out_{name}"] = piece(distance, (cu > 0) & (cv > 0))
        pieces[f"shore_in_{name}"] = piece(-distance, (cu <= 0) & (cv <= 0))
    return pieces
