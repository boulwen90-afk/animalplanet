"""
Picking: the figure leans over a bush and plucks with one hand after the
other. Each hand reaches out, takes something and lifts it over the shoulder
to a basket on the back. The loop starts when the right hand plucks.
"""

from .base import Animation, Context, Pose, add, keyed, layer, planted

REACHING = {"upper": (0.20, -0.80, -0.50), "fore": (0.05, -0.90, -0.40)}
STOWING = {"upper": (0.50, 0.15, 0.85), "fore": (-0.35, 0.75, 0.50)}


def _mirror(direction):
    return (-direction[0], direction[1], direction[2])


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    feet = planted(ctx)
    # The right hand plucks while the left one is at the basket, and the other way round.
    right_plucks = layer(
        s,
        **feet,
        hips_offset=(0.0, -0.05, -0.12),
        chest_turn=add(s["chest_turn"], (24.0, 0.0, 9.0)),
        head_turn=add(s["head_turn"], (10.0, 0.0, -4.0)),
        upper_arm_r=_mirror(REACHING["upper"]),
        forearm_r=_mirror(REACHING["fore"]),
        upper_arm_l=STOWING["upper"],
        forearm_l=STOWING["fore"],
    )
    left_plucks = layer(
        s,
        **feet,
        hips_offset=(0.0, -0.05, -0.12),
        chest_turn=add(s["chest_turn"], (24.0, 0.0, -9.0)),
        head_turn=add(s["head_turn"], (10.0, 0.0, 4.0)),
        upper_arm_r=_mirror(STOWING["upper"]),
        forearm_r=_mirror(STOWING["fore"]),
        upper_arm_l=REACHING["upper"],
        forearm_l=REACHING["fore"],
    )
    return keyed(
        [(0.0, right_plucks), (0.12, right_plucks), (0.5, left_plucks), (0.62, left_plucks), (1.0, right_plucks)],
        phase,
    )


PICK = Animation("pick", frames=8, fps=8.0, loop=True, pose=pose)
