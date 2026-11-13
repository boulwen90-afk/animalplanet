"""Rendering to PNG, and the small image operations the previews need."""

import math

import bpy
import numpy as np

# Blender's own modules can only be imported once bpy has been.
import addon_utils  # noqa: E402  isort: skip

from .materials import TEAM_MATERIAL, hex_to_linear


def new_scene(samples: int) -> bpy.types.Scene:
    """An empty scene set up for Cycles on the CPU, which needs no graphics card."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable("cycles", default_set=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    # Fixed sampling and no denoiser: the same input gives the same pixels.
    scene.cycles.seed = 0
    scene.cycles.use_animated_seed = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 90
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    return scene


def set_team_color(color: str) -> None:
    material = bpy.data.materials[TEAM_MATERIAL]
    material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hex_to_linear(color)


def render(scene: bpy.types.Scene, path: str, width: int, height: int) -> np.ndarray:
    """Renders the scene to a PNG with a transparent background and returns its pixels."""
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return read_png(path)


def render_passes(scene, parts, ground, path, width: int, height: int, shadow: bool = True):
    """
    Renders the three pictures a sprite is made of:
    the figure with its team-coloured parts white, those parts alone (the
    mask), and the shadow on the ground. Lighting is the same in all three.
    """
    figure = render(scene, path, width, height)

    for part in parts:
        part.is_holdout = part.data.materials[0].name != TEAM_MATERIAL
    mask = render(scene, path, width, height)
    for part in parts:
        part.is_holdout = False

    shade = np.zeros_like(figure)
    if shadow:
        ground.hide_render = False
        for part in parts:
            part.visible_camera = False
        shade = render(scene, path, width, height)
        for part in parts:
            part.visible_camera = True
        ground.hide_render = True
    return figure, mask, shade


def read_png(path) -> np.ndarray:
    """Pixels as floats 0..1 in an array of shape (height, width, 4), top row first."""
    image = bpy.data.images.load(str(path), check_existing=False)
    width, height = image.size
    flat = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(flat)
    bpy.data.images.remove(image)
    return flat.reshape(height, width, 4)[::-1].copy()


def write_png(path, pixels: np.ndarray) -> None:
    height, width, _ = pixels.shape
    image = bpy.data.images.new("out", width, height, alpha=True)
    image.pixels.foreach_set(np.ascontiguousarray(pixels[::-1], dtype=np.float32).ravel())
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def hex_to_rgb(value: str) -> np.ndarray:
    text = value.lstrip("#")
    return np.array([int(text[i : i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)


def add_outline(pixels: np.ndarray, color: str, strength: float, radius: float) -> np.ndarray:
    """Draws a soft dark edge of `radius` pixels around the figure, so it stands out against the ground."""
    alpha = pixels[..., 3]
    reach = int(math.ceil(radius + 0.5))
    padded = np.pad(alpha, reach)
    height, width = alpha.shape
    around = alpha.copy()
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            weight = min(1.0, max(0.0, radius + 0.5 - math.hypot(dx, dy)))
            if weight <= 0 or (dx == 0 and dy == 0):
                continue
            shifted = padded[reach + dy : reach + dy + height, reach + dx : reach + dx + width]
            around = np.maximum(around, shifted * weight)
    edge = np.clip(around - alpha, 0.0, 1.0) * strength
    total = alpha + edge
    rgb = hex_to_rgb(color)
    result = np.zeros_like(pixels)
    visible = total > 1e-6
    for c in range(3):
        blended = (pixels[..., c] * alpha + rgb[c] * edge) / np.maximum(total, 1e-6)
        result[..., c] = np.where(visible, blended, 0.0)
    result[..., 3] = np.clip(total, 0.0, 1.0)
    return result


def over(canvas: np.ndarray, sprite: np.ndarray, left: int, top: int) -> None:
    """Pastes a sprite onto a canvas, respecting the transparency of both."""
    # Keep only the part of the sprite that lands on the canvas.
    y0, x0 = max(0, -top), max(0, -left)
    y1 = min(sprite.shape[0], canvas.shape[0] - top)
    x1 = min(sprite.shape[1], canvas.shape[1] - left)
    if y1 <= y0 or x1 <= x0:
        return
    sprite = sprite[y0:y1, x0:x1]
    region = canvas[top + y0 : top + y1, left + x0 : left + x1]
    a = sprite[..., 3:4]
    under = region[..., 3:4] * (1 - a)
    total = a + under
    rgb = (sprite[..., :3] * a + region[..., :3] * under) / np.maximum(total, 1e-6)
    region[..., :3] = np.where(total > 1e-6, rgb, 0.0)
    region[..., 3:4] = total


def to_linear(srgb: np.ndarray) -> np.ndarray:
    """From the colours stored in a picture to amounts of light."""
    return np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)


def to_srgb(linear: np.ndarray) -> np.ndarray:
    linear = np.clip(linear, 0.0, 1.0)
    return np.where(linear <= 0.0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - 0.055)


def recolor(base: np.ndarray, mask: np.ndarray, color: str, neutral: str) -> np.ndarray:
    """
    Gives the team-coloured parts of a picture a colour. `base` is the figure
    rendered with those parts in the `neutral` grey. `mask` holds only those
    parts, as shaded grey with their coverage as alpha. The light from the
    grey parts is replaced by the same light scaled from grey to the colour,
    pixel by pixel. The sums are
    done on amounts of light, not on stored colour values, so that the result
    matches a figure rendered in that colour. The game does the same thing
    when it loads the pictures.
    """
    alpha = base[..., 3:4]
    team = to_linear(mask[..., :3]) * mask[..., 3:4]
    tint = to_linear(hex_to_rgb(color)) / to_linear(hex_to_rgb(neutral))
    light = to_linear(base[..., :3]) * alpha - team * (1.0 - tint)
    result = base.copy()
    result[..., :3] = to_srgb(np.where(alpha > 1e-6, light / np.maximum(alpha, 1e-6), 0.0))
    return result


def with_shadow(figure: np.ndarray, shadow: np.ndarray, color: str, strength: float) -> np.ndarray:
    """Puts the figure on top of the shadow it casts on the ground."""
    canvas = np.zeros_like(figure)
    canvas[..., :3] = hex_to_rgb(color)
    # The ground is a little darker everywhere under an open sky; only what is
    # darker than that counts as shadow, so the picture is clear at its edges.
    floor = 0.04
    canvas[..., 3] = np.clip((shadow[..., 3] - floor) / (1 - floor), 0.0, 1.0) * strength
    # A long shadow fades out before the edge of the picture instead of being cut off there.
    height, width = shadow.shape[:2]
    margin = max(1.0, 0.1 * min(height, width))
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float32)
    to_edge = np.minimum(np.minimum(xs, width - 1 - xs), np.minimum(ys, height - 1 - ys))
    canvas[..., 3] *= np.clip(to_edge / margin, 0.0, 1.0)
    over(canvas, figure, 0, 0)
    return canvas


def halve(pixels: np.ndarray) -> np.ndarray:
    """Shrinks a picture to half its size by averaging 2x2 pixels, as a screen does."""
    height, width = pixels.shape[0] // 2 * 2, pixels.shape[1] // 2 * 2
    premultiplied = pixels[:height, :width].copy()
    premultiplied[..., :3] *= premultiplied[..., 3:4]
    small = premultiplied.reshape(height // 2, 2, width // 2, 2, 4).mean(axis=(1, 3))
    alpha = small[..., 3:4]
    small[..., :3] = np.where(alpha > 1e-6, small[..., :3] / np.maximum(alpha, 1e-6), 0.0)
    return small


def flat(width: int, height: int, color: str) -> np.ndarray:
    canvas = np.ones((height, width, 4), dtype=np.float32)
    canvas[..., :3] = hex_to_rgb(color)
    return canvas


def on_background(pixels: np.ndarray, color: str) -> np.ndarray:
    canvas = flat(pixels.shape[1], pixels.shape[0], color)
    over(canvas, pixels, 0, 0)
    return canvas


def iso_ground(width: int, height: int, tile_width: int, tile_height: int, fill: str, edge: str):
    """The game's ground: diamond tiles with a darker line between them, drawn with smooth edges."""
    fine = 4
    ys, xs = np.mgrid[0 : height * fine, 0 : width * fine].astype(np.float32) / fine
    u = xs / tile_width + ys / tile_height
    v = ys / tile_height - xs / tile_width
    line = 0.6 / tile_height * (tile_height / 32)
    on_edge = (np.abs(u - np.round(u)) < line) | (np.abs(v - np.round(v)) < line)
    share = on_edge.reshape(height, fine, width, fine).mean(axis=(1, 3))[..., None]
    canvas = flat(width, height, fill)
    canvas[..., :3] = canvas[..., :3] * (1 - share) + hex_to_rgb(edge) * share
    return canvas


def feet_offset(elevation_deg: float, target_z: float, pixels_per_unit: float) -> float:
    """How far below the middle of the picture the point between the feet is, in pixels."""
    return target_z * math.cos(math.radians(elevation_deg)) * pixels_per_unit
