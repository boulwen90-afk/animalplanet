"""
Tilling: a hoe lifted to the shoulder and brought down into the ground just in
front of the feet, then drawn back through the soil. The loop starts when the
hoe bites.
"""

from .base import Animation, Context, Pose, add, keyed, layer, planted, rotate

BITE = (0.05, -0.62, -0.78)
DRAWN = (0.05, -0.35, -0.94)
RAISED = (-0.10, -0.25, 0.97)


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    feet = planted(ctx)
    # Both hands on the haft: the left arm follows the right one, a little lower down.
    bite = layer(
        s,
        **feet,
        hips_offset=(0.0, -0.05, -0.14),
        chest_turn=add(s["chest_turn"], (30.0, 0.0, 6.0)),
        head_turn=add(s["head_turn"], (10.0, 0.0, 0.0)),
        upper_arm_r=(-0.25, -0.60, -0.75),
        forearm_r=(0.10, -0.75, -0.65),
        upper_arm_l=(0.30, -0.65, -0.70),
        forearm_l=(-0.30, -0.70, -0.65),
        weapon_dir=BITE,
        weapon_flat=rotate(BITE, "X", 90.0),
    )
    drawn = layer(
        bite,
        hips_offset=(0.0, 0.0, -0.10),
        chest_turn=add(s["chest_turn"], (22.0, 0.0, 4.0)),
        upper_arm_r=(-0.30, -0.35, -0.90),
        forearm_r=(0.05, -0.55, -0.83),
        upper_arm_l=(0.32, -0.45, -0.85),
        forearm_l=(-0.30, -0.55, -0.78),
        weapon_dir=DRAWN,
        weapon_flat=rotate(DRAWN, "X", 90.0),
    )
    raised = layer(
        s,
        **feet,
        hips_offset=(0.0, 0.02, -0.02),
        chest_turn=add(s["chest_turn"], (4.0, 0.0, -6.0)),
        head_turn=add(s["head_turn"], (2.0, 0.0, 0.0)),
        upper_arm_r=(-0.40, -0.30, 0.20),
        forearm_r=(-0.10, -0.20, 0.97),
        upper_arm_l=(0.35, -0.55, -0.20),
        forearm_l=(-0.35, -0.45, 0.80),
        weapon_dir=RAISED,
        weapon_flat=rotate(RAISED, "X", 90.0),
    )
    return keyed([(0.0, bite), (0.12, bite), (0.36, drawn), (0.72, raised), (0.82, raised), (1.0, bite)], phase)


TILL = Animation("till", frames=8, fps=8.0, loop=True, pose=pose)
