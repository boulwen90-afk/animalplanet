"""
Moving at a jog. The feet are placed on the ground and the legs follow, so the
same cycle fits short and long legs. Arms keep their stance and swing a little
against the legs, which works whether or not they carry anything.
"""

import math

from .base import Animation, Context, Pose, add, ease, layer, rotate, wave

STRIDE = 0.62        # how far a foot travels from front to back, in Blender units
LIFT = 0.26          # how high a foot is lifted
BOB = 0.05           # how much the hips rise and fall


def _foot(cycle: float, x: float, rest_z: float) -> tuple[tuple[float, float, float], float]:
    """Where a foot is in its own cycle (0 = it lands in front), and how its toes point."""
    cycle %= 1.0
    if cycle < 0.5:
        # On the ground, sliding back under the body. Forward is -Y.
        on_ground = cycle / 0.5
        y = -STRIDE / 2 + STRIDE * on_ground
        pitch = -18.0 * (1 - ease(on_ground / 0.2)) + 22.0 * ease((on_ground - 0.7) / 0.3)
        return (x, y, rest_z), pitch
    in_air = (cycle - 0.5) / 0.5
    y = STRIDE / 2 - STRIDE * ease(in_air)
    z = rest_z + LIFT * math.sin(math.pi * in_air)
    pitch = 22.0 - 40.0 * ease(in_air)
    return (x, y, z), pitch


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    rest = ctx.rest.joints
    # Feet run closer together than they stand.
    left, left_pitch = _foot(phase, rest["foot_l"].x * 0.75, rest["foot_l"].z)
    right, right_pitch = _foot(phase + 0.5, rest["foot_r"].x * 0.75, rest["foot_r"].z)
    step = math.cos(2 * math.pi * phase)        # 1 when the left foot lands in front
    sway = math.sin(2 * math.pi * phase)        # the weight shifts from foot to foot
    arm_r = -16.0 * step                        # the sword arm goes forward with the left foot
    arm_l = 12.0 * step
    return layer(
        s,
        foot_l=left,
        foot_r=right,
        foot_pitch_l=left_pitch,
        foot_pitch_r=right_pitch,
        hips_offset=(0.03 * sway, -0.06, -0.06 - BOB * math.cos(4 * math.pi * phase)),
        hips_turn=(0.0, 0.0, -9.0 * step),
        chest_turn=add(s["chest_turn"], (12.0, 5.0 * sway, 8.0 * step)),
        head_turn=add(s["head_turn"], (-9.0, -3.0 * sway, -4.0 * step)),
        upper_arm_r=rotate(s["upper_arm_r"], "X", arm_r),
        forearm_r=rotate(s["forearm_r"], "X", arm_r),
        weapon_dir=rotate(s["weapon_dir"], "X", arm_r * 1.3),
        upper_arm_l=rotate(s["upper_arm_l"], "X", arm_l),
        forearm_l=rotate(s["forearm_l"], "X", arm_l),
        shield_normal=rotate(s["shield_normal"], "X", arm_l),
        cape_swing=16.0 + 6.0 * wave(phase, cycles=2, shift=0.15),
    )


WALK = Animation("walk", frames=8, fps=16.0, loop=True, pose=pose)
