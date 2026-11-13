"""
Beaten: the figure reels from the last blow and drops to one knee with its
weapon lowered and its head bowed. Nobody dies in this game; a beaten unit
gives up and then leaves the field. Played once.
"""

from .base import Animation, Context, Pose, add, keyed, layer, planted


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    feet = planted(ctx)
    guard = layer(s, **feet)
    reel = layer(
        s,
        **feet,
        hips_offset=(0.0, 0.14, -0.04),
        chest_turn=add(s["chest_turn"], (-16.0, 4.0, -10.0)),
        head_turn=add(s["head_turn"], (-14.0, 0.0, 8.0)),
        upper_arm_r=(-0.90, 0.25, -0.10),
        forearm_r=(-0.70, 0.10, 0.50),
        weapon_dir=(-0.80, 0.30, 0.50),
        upper_arm_l=(0.80, -0.10, -0.50),
        forearm_l=(0.50, -0.60, 0.10),
        shield_normal=(0.60, -0.70, 0.30),
        cape_swing=-6.0,
    )
    kneel = layer(
        s,
        **feet,
        hips_offset=(0.0, -0.02, -0.34),
        chest_turn=add(s["chest_turn"], (26.0, 0.0, 6.0)),
        head_turn=add(s["head_turn"], (22.0, 0.0, 0.0)),
        upper_arm_r=(-0.45, -0.25, -0.85),
        forearm_r=(-0.20, -0.55, -0.80),
        weapon_dir=(-0.20, -0.55, -0.80),
        upper_arm_l=(0.40, -0.20, -0.90),
        forearm_l=(0.05, -0.55, -0.80),
        shield_normal=(0.80, -0.50, 0.20),
        cape_swing=8.0,
    )
    bowed = layer(
        kneel,
        hips_offset=(0.0, -0.03, -0.37),
        chest_turn=add(s["chest_turn"], (32.0, 0.0, 6.0)),
        head_turn=add(s["head_turn"], (30.0, 0.0, 0.0)),
    )
    return keyed([(0.0, guard), (0.22, reel), (0.7, kneel), (1.0, bowed)], phase)


DEFEAT = Animation("defeat", frames=7, fps=10.0, loop=False, pose=pose)
