"""
Hammering: short blows at waist height, from the elbow, while the other hand
steadies the work. The loop starts when the hammer lands.
"""

from .base import Animation, Context, Pose, add, keyed, layer, planted, rotate

DOWN = (0.0, -0.90, -0.45)
UP = (-0.05, 0.20, 1.0)


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    feet = planted(ctx)
    steady = {"upper_arm_l": (0.30, -0.55, -0.80), "forearm_l": (-0.25, -0.90, -0.20)}
    strike = layer(
        s,
        **feet,
        **steady,
        hips_offset=(0.0, -0.04, -0.08),
        chest_turn=add(s["chest_turn"], (18.0, 0.0, 6.0)),
        head_turn=add(s["head_turn"], (8.0, 0.0, 0.0)),
        upper_arm_r=(-0.35, -0.50, -0.80),
        forearm_r=(0.0, -0.95, -0.25),
        weapon_dir=DOWN,
        weapon_flat=rotate(DOWN, "X", 90.0),
    )
    raised = layer(
        s,
        **feet,
        **steady,
        hips_offset=(0.0, -0.02, -0.05),
        chest_turn=add(s["chest_turn"], (8.0, 0.0, -4.0)),
        head_turn=add(s["head_turn"], (4.0, 0.0, 0.0)),
        upper_arm_r=(-0.45, -0.30, -0.60),
        forearm_r=(-0.10, -0.40, 0.95),
        weapon_dir=UP,
        weapon_flat=rotate(UP, "X", 90.0),
    )
    return keyed([(0.0, strike), (0.15, strike), (0.6, raised), (0.72, raised), (1.0, strike)], phase)


HAMMER = Animation("hammer", frames=6, fps=10.0, loop=True, pose=pose)
