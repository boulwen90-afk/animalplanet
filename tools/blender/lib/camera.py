"""An orthographic camera in front of the figure, and the lights that follow it."""

import math

import bpy
from mathutils import Vector


def make_camera(scene: bpy.types.Scene, elevation_deg: float, ortho_scale: float, target_z: float):
    """
    A camera looking at the point (0, 0, target_z) from the -Y side, raised
    `elevation_deg` above the horizon. `ortho_scale` is the width of the view
    in Blender units. The figure is turned to change the view, not the camera,
    so the light always comes from the same side of the picture.
    """
    data = bpy.data.cameras.new("camera")
    data.type = "ORTHO"
    data.ortho_scale = ortho_scale
    camera = bpy.data.objects.new("camera", data)
    scene.collection.objects.link(camera)

    elevation = math.radians(elevation_deg)
    target = Vector((0.0, 0.0, target_z))
    away = Vector((0.0, -math.cos(elevation), math.sin(elevation)))
    camera.location = target + away * 20.0
    camera.rotation_euler = (-away).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    return camera


def make_lights(scene: bpy.types.Scene, lighting: dict) -> None:
    """A key light from the upper left, a weak fill from the right, and even light from the sky."""
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    background.inputs["Strength"].default_value = lighting["sky"]
    scene.world = world

    for name, direction, strength in (
        ("key", lighting["key_from"], lighting["key"]),
        ("fill", lighting["fill_from"], lighting["fill"]),
    ):
        data = bpy.data.lights.new(name, "SUN")
        data.energy = strength
        data.angle = math.radians(lighting.get("softness_deg", 8.0))
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = Vector(direction) * 10.0
        light.rotation_euler = (-Vector(direction)).to_track_quat("-Z", "Y").to_euler()
