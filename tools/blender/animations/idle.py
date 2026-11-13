"""Standing ready: slow breathing, a slight sway of the weapon and a glance to each side."""

from .base import Animation, Context, Pose, add, layer, planted, rotate, wave


def pose(phase: float, ctx: Context) -> Pose:
    s = ctx.stance
    breath = 0.5 - 0.5 * wave(phase, shift=0.25)   # 0 at the start, 1 half way
    sway = wave(phase)
    return layer(
        s,
        **planted(ctx),
        hips_offset=(0.0, 0.0, -0.025 * breath),
        chest_turn=add(s["chest_turn"], (2.0 * breath, 0.0, 1.0 * sway)),
        head_turn=add(s["head_turn"], (-1.5 * breath, 0.0, 4.0 * sway)),
        upper_arm_r=rotate(s["upper_arm_r"], "Y", -2.0 * breath),
        weapon_dir=rotate(s["weapon_dir"], "X", 4.0 * sway),
        forearm_l=rotate(s["forearm_l"], "X", -2.5 * breath),
        cape_swing=1.5 * breath,
    )


IDLE = Animation("idle", frames=6, fps=4.0, loop=True, pose=pose)
