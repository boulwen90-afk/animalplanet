"""
Fishing: the rod is held out over the water and bobs a little while the
figure waits; then it is jerked up with a fish on the line, and cast out
again. The loop starts when the rod is jerked up.
"""

import math

from .base import Animation, Context, Pose, add, keyed, layer, planted, rotate

# Where the rod points: out over the water while waiting, and up when a fish bites.
OUT = (0.0, -0.80, 0.60)
UP = (0.0, -0.38, 0.92)


def _held(direction) -> dict:
    # The line hangs in the plane the rod swings in: see the rod in lib/weapons.py.
    return {"weapon_dir": direction, "weapon_flat": rotate(direction, "X", 90.0)}


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    feet = planted(ctx)
    # Both hands on the rod, the left one further out along it.
    waiting = layer(
        s,
        **feet,
        hips_offset=(0.0, -0.02, -0.05),
        chest_turn=add(s["chest_turn"], (8.0, 0.0, 4.0)),
        head_turn=add(s["head_turn"], (8.0, 0.0, 0.0)),
        upper_arm_r=(-0.20, -0.45, -0.85),
        forearm_r=(0.10, -0.90, 0.25),
        upper_arm_l=(0.25, -0.60, -0.70),
        forearm_l=(-0.25, -0.90, 0.20),
        **_held(OUT),
    )
    # A small dip of the tip, as the float is pulled at.
    dip = rotate(OUT, "X", 5.0)
    nibble = layer(waiting, **_held(dip))
    strike = layer(
        s,
        **feet,
        hips_offset=(0.0, 0.03, -0.01),
        chest_turn=add(s["chest_turn"], (-6.0, 0.0, 0.0)),
        head_turn=add(s["head_turn"], (-6.0, 0.0, 0.0)),
        upper_arm_r=(-0.25, -0.30, -0.60),
        forearm_r=(0.05, -0.55, 0.80),
        upper_arm_l=(0.30, -0.50, -0.35),
        forearm_l=(-0.25, -0.60, 0.72),
        **_held(UP),
    )
    return keyed(
        [(0.0, strike), (0.16, strike), (0.42, waiting), (0.6, nibble), (0.74, waiting), (0.86, nibble), (1.0, strike)],
        phase,
    )


# One loop for each fish: 1.6 seconds, the time a worker takes to catch one.
FISH = Animation("fish", frames=8, fps=5.0, loop=True, pose=pose)
