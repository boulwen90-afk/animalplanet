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


def add_outline(pixels: np.ndarray, color: str, strength: float = 1.0) -> np.ndarray:
    """Draws a one-pixel dark edge around the figure, so it stands out against the ground."""
    alpha = pixels[..., 3]
    padded = np.pad(alpha, 1)
    around = np.maximum.reduce(
        [padded[:-2, 1:-1], padded[2:, 1:-1], padded[1:-1, :-2], padded[1:-1, 2:]]
    )
    edge = np.clip(around - alpha, 0.0, 1.0) * strength
    result = pixels.copy()
    rgb = hex_to_rgb(color)
    total = alpha + edge
    visible = total > 0
    for c in range(3):
        blended = np.where(visible, (pixels[..., c] * alpha + rgb[c] * edge) / np.maximum(total, 1e-6), 0)
        result[..., c] = blended
    result[..., 3] = np.clip(total, 0.0, 1.0)
    return result


def over(canvas: np.ndarray, sprite: np.ndarray, left: int, top: int) -> None:
    """Pastes a sprite onto a canvas, respecting its transparency."""
    # Keep only the part of the sprite that lands on the canvas.
    y0, x0 = max(0, -top), max(0, -left)
    y1 = min(sprite.shape[0], canvas.shape[0] - top)
    x1 = min(sprite.shape[1], canvas.shape[1] - left)
    if y1 <= y0 or x1 <= x0:
        return
    sprite = sprite[y0:y1, x0:x1]
    region = canvas[top + y0 : top + y1, left + x0 : left + x1]
    alpha = sprite[..., 3:4]
    region[..., :3] = sprite[..., :3] * alpha + region[..., :3] * (1 - alpha)
    region[..., 3:4] = alpha + region[..., 3:4] * (1 - alpha)


def flat(width: int, height: int, color: str) -> np.ndarray:
    canvas = np.ones((height, width, 4), dtype=np.float32)
    canvas[..., :3] = hex_to_rgb(color)
    return canvas


def on_background(pixels: np.ndarray, color: str) -> np.ndarray:
    canvas = flat(pixels.shape[1], pixels.shape[0], color)
    over(canvas, pixels, 0, 0)
    return canvas


def upscale(pixels: np.ndarray, factor: int) -> np.ndarray:
    """Enlarges without smoothing, so every pixel of the original stays visible."""
    return pixels.repeat(factor, axis=0).repeat(factor, axis=1)


def iso_ground(width: int, height: int, tile_width: int, tile_height: int, fill: str, edge: str):
    """The game's ground: diamond tiles with a darker line between them."""
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float32)
    u = xs / tile_width + ys / tile_height
    v = ys / tile_height - xs / tile_width
    line = 1.2 / tile_height
    on_edge = (np.abs(u - np.round(u)) < line) | (np.abs(v - np.round(v)) < line)
    canvas = flat(width, height, fill)
    canvas[on_edge, :3] = hex_to_rgb(edge)
    return canvas


def feet_offset(elevation_deg: float, target_z: float, pixels_per_unit: float) -> float:
    """How far below the middle of the picture the point between the feet is, in pixels."""
    return target_z * math.cos(math.radians(elevation_deg)) * pixels_per_unit
