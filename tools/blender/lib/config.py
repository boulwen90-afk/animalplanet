"""Loads the config files: one per race, one per unit type, and the game settings."""

import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load(path: Path) -> dict:
    if not path.is_file():
        raise SystemExit(f"Config file not found: {path}")
    with path.open("rb") as handle:
        return tomllib.load(handle)


def load_race(name: str) -> dict:
    return _load(ROOT / "races" / f"{name}.toml")


def load_unit(name: str) -> dict:
    return _load(ROOT / "units" / f"{name}.toml")


def load_game() -> dict:
    """Settings shared by every figure: sprite scale, camera angle, team colours."""
    return _load(ROOT / "game.toml")


def load_figures() -> list[dict]:
    """The figures the game uses, as pairs of race and unit names."""
    return _load(ROOT / "figures.toml")["figure"]
