"""
A heavy overhead blow with the weapon hand. The loop starts at the moment the
blow lands, so the game can line that frame up with the hit; the wind-up for
the next blow comes at the end of the loop.
"""

from .base import Animation, Context, Pose, add, keyed, layer, planted, rotate


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    feet = planted(ctx)
    guard = layer(s, **feet)

    # The blow has landed: the body is thrown forward behind the blade.
    impact = layer(
        s,
        **feet,
        hips_offset=(0.0, -0.16, -0.07),
        hips_turn=(0.0, 0.0, 8.0),
        chest_turn=add(s["chest_turn"], (20.0, 0.0, 24.0)),
        head_turn=add(s["head_turn"], (-8.0, 0.0, -12.0)),
        upper_arm_r=(-0.25, -0.85, -0.30),
        forearm_r=(0.10, -0.90, -0.35),
        weapon_dir=(0.25, -0.90, -0.40),
        weapon_flat=(1.0, 0.2, 0.3),
        upper_arm_l=rotate(s["upper_arm_l"], "X", 14.0),
        forearm_l=rotate(s["forearm_l"], "Z", -18.0),
        shield_normal=rotate(s["shield_normal"], "Z", -18.0),
        cape_swing=14.0,
    )
    # The blade swings on past the target.
    follow = layer(
        impact,
        hips_offset=(0.0, -0.12, -0.09),
        chest_turn=add(s["chest_turn"], (24.0, 0.0, 30.0)),
        upper_arm_r=(-0.05, -0.75, -0.60),
        forearm_r=(0.30, -0.70, -0.60),
        weapon_dir=(0.60, -0.55, -0.60),
        cape_swing=6.0,
    )
    # The weapon is drawn back over the shoulder.
    wind_up = layer(
        s,
        **feet,
        hips_offset=(0.0, 0.07, -0.02),
        hips_turn=(0.0, 0.0, -6.0),
        chest_turn=add(s["chest_turn"], (-8.0, 0.0, -22.0)),
        head_turn=add(s["head_turn"], (4.0, 0.0, 12.0)),
        upper_arm_r=(-0.65, 0.30, 0.70),
        forearm_r=(-0.10, 0.45, 0.90),
        weapon_dir=(-0.15, 0.80, 0.60),
        upper_arm_l=rotate(s["upper_arm_l"], "X", -10.0),
        forearm_l=rotate(s["forearm_l"], "X", -10.0),
        shield_normal=rotate(s["shield_normal"], "X", -10.0),
        cape_swing=-4.0,
    )
    return keyed(
        [(0.0, impact), (0.16, follow), (0.42, guard), (0.66, guard), (0.86, wind_up), (1.0, impact)],
        phase,
    )


ATTACK = Animation("attack", frames=10, fps=10.0, loop=True, pose=pose)
