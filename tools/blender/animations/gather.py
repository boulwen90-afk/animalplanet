"""
Work: a tool swung down from the shoulder, as when chopping wood or digging.
The loop starts when the tool strikes. The edge of the tool leads the swing:
its flat side stays in the plane the tool is swung in.
"""

from .base import Animation, Context, Pose, add, keyed, layer, planted, rotate


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    feet = planted(ctx)
    strike = layer(
        s,
        **feet,
        hips_offset=(0.0, -0.06, -0.10),
        chest_turn=add(s["chest_turn"], (26.0, 0.0, 10.0)),
        head_turn=add(s["head_turn"], (6.0, 0.0, 0.0)),
        upper_arm_r=(-0.25, -0.70, -0.65),
        forearm_r=(0.05, -0.80, -0.60),
        weapon_dir=(0.10, -0.75, -0.65),
        weapon_flat=rotate((0.10, -0.75, -0.65), "X", 90.0),
        upper_arm_l=(0.25, -0.55, -0.80),
        forearm_l=(-0.30, -0.75, -0.55),
    )
    lifted = layer(
        s,
        **feet,
        hips_offset=(0.0, 0.03, 0.0),
        chest_turn=add(s["chest_turn"], (-6.0, 0.0, -8.0)),
        head_turn=add(s["head_turn"], (-4.0, 0.0, 0.0)),
        upper_arm_r=(-0.45, -0.10, 0.90),
        forearm_r=(-0.10, 0.20, 0.95),
        weapon_dir=(-0.10, 0.55, 0.85),
        weapon_flat=rotate((-0.10, 0.55, 0.85), "X", 90.0),
        upper_arm_l=(0.35, -0.45, -0.85),
        forearm_l=(-0.25, -0.70, 0.10),
    )
    return keyed([(0.0, strike), (0.2, strike), (0.7, lifted), (0.82, lifted), (1.0, strike)], phase)


GATHER = Animation("gather", frames=8, fps=8.0, loop=True, pose=pose)
