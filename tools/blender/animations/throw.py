"""
Throwing a javelin. The figure leans back with the javelin level beside its
head and its free arm pointing at the target, throws with its whole body,
and then reaches over its shoulder for the next javelin in the quiver.

The loop starts when the javelin leaves the hand. The hand is empty from then
until it has drawn the next one: the unit's config says in which frames
(`hidden_frames` under its weapon).
"""

from .base import Animation, Context, Pose, add, keyed, layer, planted

# Where the javelin points: at the target when it is aimed and thrown, and
# along the quiver when it is drawn.
LEVEL = (0.05, -1.0, 0.14)
DRAWN = (-0.60, 0.10, 0.75)
FLAT = (1.0, 0.0, 0.0)


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    feet = planted(ctx)
    # The javelin has just left the hand: the arm is stretched out after it
    # and the weight is on the leading foot.
    release = layer(
        s,
        **feet,
        hips_offset=(0.0, -0.10, -0.07),
        chest_turn=add(s["chest_turn"], (20.0, 0.0, 26.0)),
        head_turn=add(s["head_turn"], (-12.0, 0.0, -14.0)),
        upper_arm_r=(-0.15, -0.90, 0.20),
        forearm_r=(0.05, -0.97, -0.15),
        upper_arm_l=(0.55, 0.30, -0.80),
        forearm_l=(0.20, -0.10, -0.95),
        weapon_dir=LEVEL,
        weapon_flat=FLAT,
    )
    follow = layer(
        release,
        hips_offset=(0.0, -0.11, -0.10),
        chest_turn=add(s["chest_turn"], (26.0, 0.0, 30.0)),
        upper_arm_r=(-0.05, -0.75, -0.60),
        forearm_r=(0.25, -0.65, -0.70),
    )
    # The hand goes up over the shoulder to the quiver and takes a javelin.
    reach = layer(
        s,
        **feet,
        hips_offset=(0.0, 0.0, -0.02),
        chest_turn=add(s["chest_turn"], (2.0, 0.0, -4.0)),
        head_turn=add(s["head_turn"], (0.0, 0.0, 4.0)),
        upper_arm_r=(-0.20, 0.30, 0.93),
        forearm_r=(0.69, 0.72, 0.12),
        upper_arm_l=(0.45, -0.25, -0.85),
        forearm_l=(0.0, -0.75, -0.50),
        weapon_dir=DRAWN,
        weapon_flat=FLAT,
    )
    # The javelin is brought level beside the head, and the free arm points at the target.
    aim = layer(
        s,
        **feet,
        hips_offset=(0.0, 0.05, -0.03),
        chest_turn=add(s["chest_turn"], (-4.0, 0.0, -18.0)),
        head_turn=add(s["head_turn"], (-4.0, 0.0, 16.0)),
        upper_arm_r=(-0.60, 0.35, 0.45),
        forearm_r=(-0.05, 0.30, 0.90),
        upper_arm_l=(0.25, -0.80, -0.35),
        forearm_l=(-0.10, -0.95, 0.10),
        weapon_dir=LEVEL,
        weapon_flat=FLAT,
    )
    # Leaning back on the rear foot, the throwing arm drawn far back.
    wind_up = layer(
        aim,
        hips_offset=(0.0, 0.12, -0.08),
        chest_turn=add(s["chest_turn"], (-10.0, 0.0, -34.0)),
        head_turn=add(s["head_turn"], (-2.0, 0.0, 30.0)),
        upper_arm_r=(-0.50, 0.75, 0.30),
        forearm_r=(-0.10, 0.50, 0.80),
        upper_arm_l=(0.20, -0.90, -0.10),
        forearm_l=(-0.10, -0.95, 0.20),
        weapon_dir=(0.05, -1.0, 0.20),
    )
    return keyed(
        [
            (0.0, release),
            (0.10, follow),
            (0.22, follow),
            (0.40, reach),
            (0.46, reach),
            (0.66, aim),
            (0.76, aim),
            (0.90, wind_up),
            (1.0, release),
        ],
        phase,
    )


# The game steps through the loop at the pace of the unit's throws: 1.8
# seconds for a bear's javelin thrower, which is 0.15 seconds a frame.
THROW = Animation("throw", frames=12, fps=6.67, loop=True, pose=pose)
