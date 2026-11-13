"""
What every animation is built from.

An animation is a function from a phase (0..1) to a pose. It starts from the
unit's own stance and changes only what moves, so the same animation works for
any race and any unit that has the shared skeleton.
"""

import math
from dataclasses import dataclass
from typing import Callable

import bpy  # noqa: F401  Blender's own modules can only be imported once bpy has been.
from mathutils import Matrix, Vector

from lib.skeleton import Skeleton

Pose = dict


@dataclass
class Context:
    """What an animation may know about the figure it is played on."""

    stance: Pose           # the unit's standing pose, complete
    proportions: dict      # the race's lengths
    rest: Skeleton         # the figure standing in its stance


@dataclass(frozen=True)
class Animation:
    name: str
    frames: int
    fps: float
    loop: bool
    pose: Callable[[float, Context], Pose]
    # For an animation of moving along the ground: how far the figure travels
    # in one loop, in Blender units, when its feet do not slide. The game
    # plays the animation at the pace the unit really moves.
    distance: Callable[[Context], float] | None = None

    def phase(self, index: int) -> float:
        """Where in the animation a frame is. A loop never shows its end, which equals its start."""
        if self.loop:
            return index / self.frames
        return index / max(1, self.frames - 1)


def ease(t: float) -> float:
    """Slow start and slow stop between 0 and 1."""
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def wave(phase: float, cycles: float = 1.0, shift: float = 0.0) -> float:
    """A sine wave over the animation; whole numbers of cycles close a loop without a seam."""
    return math.sin(2 * math.pi * (cycles * phase + shift))


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def mix(a, b, t: float):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def rotate(direction, axis: str, degrees: float):
    """A direction turned around one of the figure's axes ("X", "Y" or "Z")."""
    return tuple(Matrix.Rotation(math.radians(degrees), 3, axis) @ Vector(direction))


def layer(stance: Pose, **changes) -> Pose:
    """The stance with some values replaced."""
    return {**stance, **changes}


def planted(ctx: Context) -> dict:
    """Foot targets that keep both feet where they stand in the stance."""
    return {
        "foot_l": tuple(ctx.rest.joints["foot_l"]),
        "foot_r": tuple(ctx.rest.joints["foot_r"]),
    }


def blend(a: Pose, b: Pose, t: float) -> Pose:
    """A pose between two poses. Both must give the same values."""
    result = {}
    for key, value in a.items():
        other = b[key]
        if value is None or other is None:
            result[key] = value if t < 0.5 else other
        elif isinstance(value, (int, float)):
            result[key] = value + (other - value) * t
        else:
            result[key] = mix(value, other, t)
    return result


def keyed(keys: list[tuple[float, Pose]], phase: float) -> Pose:
    """
    The pose at a phase, eased between key poses given as (time, pose) in
    rising order of time. For a loop, give the first pose again at time 1.
    """
    for (t0, p0), (t1, p1) in zip(keys, keys[1:]):
        if t0 <= phase <= t1:
            return blend(p0, p1, ease((phase - t0) / (t1 - t0)))
    return keys[-1][1] if phase > keys[-1][0] else keys[0][1]
