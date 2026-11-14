"""Flat, low-poly materials. Colours are given as "#rrggbb" in the config files."""

import bpy

# The one material that is recoloured per player.
TEAM_MATERIAL = "team_color"


def hex_to_linear(value: str) -> tuple[float, float, float, float]:
    """Converts "#rrggbb" (sRGB) to the linear colour Blender's shaders expect."""
    text = value.lstrip("#")
    if len(text) != 6:
        raise ValueError(f"Expected a colour like #a1b2c3, got {value!r}")

    def channel(byte: int) -> float:
        c = byte / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(int(text[i : i + 2], 16)) for i in (0, 2, 4))
    return (r, g, b, 1.0)


def make_material(
    name: str, color: str, roughness: float = 0.9, metallic: float = 0.0
) -> bpy.types.Material:
    """Creates a material, or returns the one already made under that name."""
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = hex_to_linear(color)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return material


class Palette:
    """The materials of one figure, looked up by the names used in the config files."""

    def __init__(self, team_color: str) -> None:
        self._materials: dict[str, bpy.types.Material] = {}
        self._materials["team"] = make_material(TEAM_MATERIAL, team_color, roughness=0.85)

    def add(self, key: str, color: str, roughness: float = 0.9, metallic: float = 0.0) -> None:
        self._materials[key] = make_material(key, color, roughness, metallic)

    def add_all(self, colors: dict[str, str], metal: tuple[str, ...] = ()) -> None:
        for key, color in colors.items():
            if key in metal:
                self.add(key, color, roughness=0.6, metallic=0.25)
            else:
                self.add(key, color)

    def __getitem__(self, key: str) -> bpy.types.Material:
        if key not in self._materials:
            raise KeyError(f"No colour named {key!r} in the race or unit config")
        return self._materials[key]
