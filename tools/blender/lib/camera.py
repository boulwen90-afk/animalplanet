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
    """Even light from the sky plus the suns listed in game.toml (key, fill, rim)."""
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    background.inputs["Strength"].default_value = lighting["sky"]
    scene.world = world

    for sun in lighting["suns"]:
        data = bpy.data.lights.new(sun["name"], "SUN")
        data.energy = sun["strength"]
        data.angle = math.radians(sun.get("softness_deg", 8.0))
        # Only the key light casts a shadow, so the figure has one shadow on the ground.
        data.use_shadow = sun.get("shadow", False)
        light = bpy.data.objects.new(sun["name"], data)
        scene.collection.objects.link(light)
        direction = Vector(sun["from"])
        light.location = direction * 10.0
        light.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()


def make_shadow_catcher(scene: bpy.types.Scene) -> bpy.types.Object:
    """An invisible ground that only shows the shadow falling on it."""
    mesh = bpy.data.meshes.new("ground")
    size = 20.0
    mesh.from_pydata(
        [(-size, -size, 0), (size, -size, 0), (size, size, 0), (-size, size, 0)], [], [(0, 1, 2, 3)]
    )
    ground = bpy.data.objects.new("ground", mesh)
    ground.is_shadow_catcher = True
    ground.hide_render = True
    scene.collection.objects.link(ground)
    return ground
