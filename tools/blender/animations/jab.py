"""
A thrust at close quarters with a spear or a javelin held in one hand: drawn
back at the hip and stabbed straight forward. It is what a figure that fights
from a distance does when an enemy gets up to it. The loop starts when the
thrust lands.
"""

from .base import Animation, Context, Pose, add, keyed, layer, planted

FORWARD = (0.04, -1.0, -0.04)
FLAT = (1.0, 0.0, 0.0)


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    feet = planted(ctx)
    guard = {"upper_arm_l": (0.35, -0.55, -0.70), "forearm_l": (-0.35, -0.80, 0.25)}
    thrust = layer(
        s,
        **feet,
        **guard,
        hips_offset=(0.0, -0.10, -0.08),
        chest_turn=add(s["chest_turn"], (16.0, 0.0, 22.0)),
        head_turn=add(s["head_turn"], (-8.0, 0.0, -10.0)),
        upper_arm_r=(-0.15, -0.85, -0.35),
        forearm_r=(0.05, -0.98, -0.05),
        weapon_dir=FORWARD,
        weapon_flat=FLAT,
    )
    drawn_back = layer(
        s,
        **feet,
        **guard,
        hips_offset=(0.0, 0.06, -0.05),
        chest_turn=add(s["chest_turn"], (2.0, 0.0, -16.0)),
        head_turn=add(s["head_turn"], (0.0, 0.0, 12.0)),
        upper_arm_r=(-0.45, 0.60, -0.65),
        forearm_r=(0.0, -0.95, 0.20),
        weapon_dir=(0.04, -1.0, 0.06),
        weapon_flat=FLAT,
    )
    return keyed(
        [(0.0, thrust), (0.14, thrust), (0.5, drawn_back), (0.8, drawn_back), (1.0, thrust)],
        phase,
    )


JAB = Animation("jab", frames=8, fps=8.0, loop=True, pose=pose)
