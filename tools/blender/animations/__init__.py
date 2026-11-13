"""
The shared library of animations. Every race and unit with the shared skeleton
can use them: a unit's config lists the ones it needs by name.
"""

from .attack import ATTACK
from .base import Animation, Context
from .defeat import DEFEAT
from .gather import GATHER
from .idle import IDLE
from .walk import WALK

ANIMATIONS: dict[str, Animation] = {
    animation.name: animation for animation in (IDLE, WALK, ATTACK, GATHER, DEFEAT)
}

__all__ = ["ANIMATIONS", "Animation", "Context"]
