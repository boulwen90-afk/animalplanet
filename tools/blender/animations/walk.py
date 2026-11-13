"""
Moving at a run. Each foot is planted, stays put on the ground while the body
passes over it, and is then swung forward through the air; between the two
feet's turns on the ground the figure is in the air.

While a foot is on the ground it moves backwards under the body at exactly
the pace the body moves forwards, so it does not slide. How far the body
travels in one loop is `distance`; the game steps through the loop by the
distance a unit has really moved, so the feet stay planted whatever its speed.

The cycle is sized from the length of the legs, so it fits any race. How fast
the legs go follows from the unit's speed and the length of a stride. A small
unit that moves fast would patter along, so the stride is fitted to the
speed (`ground_share`): the figure leaps further between its steps instead of
taking more of them. Arms keep their stance and swing a little against the
legs, which works whether or not they carry anything.
"""

import math

from .base import Animation, Context, Pose, add, ease, layer, rotate, wave

ON_GROUND = 0.3      # the share of the loop a foot is on the ground, at the gait's natural pace
# The share may not go below or above these: a foot needs some time on the
# ground to read as a step, and above the upper limit the run turns into a shuffle.
GROUND_SHARE_LIMITS = (0.15, 0.55)
REACH = 0.86         # how far a foot travels on the ground, as a share of the leg's length
LIFT = 0.42          # how high a foot is lifted, as a share of the leg's length
BOB = 0.05           # how much the hips rise and fall


def _leg(ctx: Context) -> float:
    return ctx.proportions["thigh"] + ctx.proportions["shin"]


def _share(ctx: Context) -> float:
    return ON_GROUND if ctx.ground_share is None else ctx.ground_share


def distance(ctx: Context) -> float:
    """How far the body travels in one loop, in Blender units."""
    return REACH * _leg(ctx) / _share(ctx)


def ground_share(leg: float, speed: float, loops_per_second: tuple[float, float]) -> tuple[float, float]:
    """
    Fits the gait to a unit's speed. `leg` is the length of a leg and `speed`
    how far the unit moves in a second, both in the figure's own proportions;
    `loops_per_second` is the slowest and the fastest the legs may go, where
    one loop is a step with each foot.

    Returns the share of a loop each foot is on the ground, and the loops per
    second that gives. Inside the limits the gait keeps its natural pace.
    Outside them the stride is made longer or shorter, so the legs go no
    faster or slower than allowed.
    """
    slowest, fastest = loops_per_second
    natural = speed / (REACH * leg / ON_GROUND)
    if slowest <= natural <= fastest:
        return ON_GROUND, natural
    pace = min(fastest, max(slowest, natural))
    share = REACH * leg * pace / speed
    low, high = GROUND_SHARE_LIMITS
    if not low <= share <= high:
        raise SystemExit(
            f"The gait cannot be fitted: at {pace:.1f} loops a second a foot would be on the "
            f"ground {share:.2f} of the time, outside {low}-{high}. Change the unit's speed, "
            "the length of its legs or gait.loops_per_second in game.toml."
        )
    return share, pace


def foot(cycle: float, x: float, rest_z: float, leg: float, on_ground: float = ON_GROUND):
    """Where a foot is in its own cycle (0 = it lands in front), and how its toes point."""
    cycle %= 1.0
    stride = REACH * leg
    if cycle < on_ground:
        # On the ground, passing back under the body at a steady pace. Forward is -Y.
        along = cycle / on_ground
        y = -stride / 2 + stride * along
        pitch = -14.0 * (1 - ease(along / 0.3)) + 24.0 * ease((along - 0.6) / 0.4)
        return (x, y, rest_z), pitch
    in_air = (cycle - on_ground) / (1 - on_ground)
    y = stride / 2 - stride * ease(in_air)
    z = rest_z + LIFT * leg * math.sin(math.pi * in_air)
    pitch = 24.0 - 38.0 * ease(in_air)
    return (x, y, z), pitch


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    rest = ctx.rest.joints
    leg = _leg(ctx)
    share = _share(ctx)
    # Feet run closer together than they stand.
    left, left_pitch = foot(phase, rest["foot_l"].x * 0.75, rest["foot_l"].z, leg, share)
    right, right_pitch = foot(phase + 0.5, rest["foot_r"].x * 0.75, rest["foot_r"].z, leg, share)
    step = math.cos(2 * math.pi * phase)        # 1 when the left foot lands in front
    sway = math.sin(2 * math.pi * phase)        # the weight shifts from foot to foot
    arm_r = -16.0 * step                        # the sword arm goes forward with the left foot
    arm_l = 12.0 * step
    # Lowest in the middle of each foot's time on the ground, highest in the air.
    height = -0.07 - BOB * math.cos(4 * math.pi * (phase - share / 2))
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
