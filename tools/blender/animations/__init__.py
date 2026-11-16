"""
The shared library of animations. Every race and unit with the shared skeleton
can use them: a unit's config lists the ones it needs by name.
"""

from .attack import ATTACK
from .base import Animation, Context
from .defeat import DEFEAT
from .fish import FISH
from .hammer import HAMMER
from .chop import CHOP
from .idle import IDLE
from .jab import JAB
from .pick import PICK
from .throw import THROW
from .till import TILL
from .walk import WALK

ANIMATIONS: dict[str, Animation] = {
    animation.name: animation for animation in (IDLE, WALK, ATTACK, THROW, JAB, CHOP, PICK, TILL, FISH, HAMMER, DEFEAT)
}

__all__ = ["ANIMATIONS", "Animation", "Context"]
