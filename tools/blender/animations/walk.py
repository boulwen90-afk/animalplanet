"""
Moving at a run. Each foot is planted, stays put on the ground while the body
passes over it, and is then swung forward through the air; between the two
feet's turns on the ground the figure is in the air.

While a foot is on the ground it moves backwards under the body at exactly
the pace the body moves forwards, so it does not slide. How far the body
travels in one loop is `distance`; the game steps through the loop by the
distance a unit has really moved, so the feet stay planted whatever its speed.

The cycle is sized from the length of the legs, so it fits any race. Arms keep
their stance and swing a little against the legs, which works whether or not
they carry anything.
"""

import math

from .base import Animation, Context, Pose, add, ease, layer, rotate, wave

ON_GROUND = 0.3      # the share of the loop a foot is on the ground
REACH = 0.86         # how far a foot travels on the ground, as a share of the leg's length
LIFT = 0.42          # how high a foot is lifted, as a share of the leg's length
BOB = 0.05           # how much the hips rise and fall


def _leg(ctx: Context) -> float:
    return ctx.proportions["thigh"] + ctx.proportions["shin"]


def distance(ctx: Context) -> float:
    """How far the body travels in one loop, in Blender units."""
    return REACH * _leg(ctx) / ON_GROUND


def foot(cycle: float, x: float, rest_z: float, leg: float):
    """Where a foot is in its own cycle (0 = it lands in front), and how its toes point."""
    cycle %= 1.0
    stride = REACH * leg
    if cycle < ON_GROUND:
        # On the ground, passing back under the body at a steady pace. Forward is -Y.
        along = cycle / ON_GROUND
        y = -stride / 2 + stride * along
        pitch = -14.0 * (1 - ease(along / 0.3)) + 24.0 * ease((along - 0.6) / 0.4)
        return (x, y, rest_z), pitch
    in_air = (cycle - ON_GROUND) / (1 - ON_GROUND)
    y = stride / 2 - stride * ease(in_air)
    z = rest_z + LIFT * leg * math.sin(math.pi * in_air)
    pitch = 24.0 - 38.0 * ease(in_air)
    return (x, y, z), pitch


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    rest = ctx.rest.joints
    leg = _leg(ctx)
    # Feet run closer together than they stand.
    left, left_pitch = foot(phase, rest["foot_l"].x * 0.75, rest["foot_l"].z, leg)
    right, right_pitch = foot(phase + 0.5, rest["foot_r"].x * 0.75, rest["foot_r"].z, leg)
    step = math.cos(2 * math.pi * phase)        # 1 when the left foot lands in front
    sway = math.sin(2 * math.pi * phase)        # the weight shifts from foot to foot
    arm_r = -16.0 * step                        # the sword arm goes forward with the left foot
    arm_l = 12.0 * step
    # Lowest in the middle of each foot's time on the ground, highest in the air.
    height = -0.07 - BOB * math.cos(4 * math.pi * (phase - ON_GROUND / 2))
    return layer(
        s,
        foot_l=left,
        foot_r=right,
        foot_pitch_l=left_pitch,
        foot_pitch_r=right_pitch,
        hips_offset=(0.03 * sway, -0.06, height),
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


WALK = Animation("walk", frames=8, fps=16.0, loop=True, pose=pose, distance=distance)
