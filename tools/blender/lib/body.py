"""Builds the animal's body from a race config. Every race uses the same parts."""

from mathutils import Vector

from .materials import Palette
from .mesh import Builder


def build_body(b: Builder, race: dict, joints: dict[str, Vector], pal: Palette) -> None:
    p, f = race["proportions"], race["features"]
    fur, dark, light = pal["fur"], pal["fur_dark"], pal["fur_light"]
    hips, chest, neck, head = joints["hips"], joints["chest"], joints["neck"], joints["head"]

    # Torso: a belly and a chest, and for heavy races a hump behind the shoulders.
    belly_radii = p["belly_radii"]
    b.ellipsoid("body.belly", hips + Vector((0, -0.02, belly_radii[2] * 0.5)), belly_radii, fur)
    b.ellipsoid("body.chest", chest, p["chest_radii"], fur)
    hump = f.get("hump", 0.0)
    if hump > 0:
        b.ellipsoid(
            "body.hump",
            neck + Vector((0, p["chest_radii"][1] * 0.45, -0.08)),
            (p["chest_radii"][0] * 0.7, p["chest_radii"][1] * 0.7, hump + 0.14),
            fur,
            detail=1,
        )
    b.limb("body.neck", neck - Vector((0, 0, 0.12)), head, p["neck_radius"], p["neck_radius"], fur)

    # Head, muzzle, nose, eyes and ears.
    hx, hy, hz = p["head_radii"]
    b.ellipsoid("body.head", head, (hx, hy, hz), fur)
    mx, my, mz = f["muzzle_radii"]
    muzzle = head + Vector((0, -(hy * 0.78 + my * 0.3), -f["muzzle_drop"]))
    b.ellipsoid("body.muzzle", muzzle, (mx, my, mz), light, detail=1)
    nose = muzzle + Vector((0, -my * 0.86, mz * 0.42))
    b.ellipsoid("body.nose", nose, (mx * 0.42, my * 0.3, mz * 0.42), pal["nose"], detail=1)
    for side, sign in (("l", 1.0), ("r", -1.0)):
        eye = head + Vector((sign * hx * 0.4, -hy * 0.86, hz * 0.1))
        b.ellipsoid(f"body.eye_{side}", eye, (0.05, 0.035, 0.06), pal["eye"], detail=1)

        r = f["ear_radius"]
        ear = head + Vector((sign * hx * f["ear_spread"], hy * 0.05, hz * f["ear_height"]))
        if f["ear"] == "round":
            b.ellipsoid(f"body.ear_{side}", ear, (r, r * 0.5, r), dark, detail=1)
            b.ellipsoid(
                f"body.ear_inner_{side}",
                ear + Vector((0, -r * 0.3, 0)),
                (r * 0.58, r * 0.3, r * 0.58),
                light,
                detail=1,
            )
        else:  # pointed
            tip = ear + Vector((sign * r * 0.4, 0, r * 2.0))
            b.limb(f"body.ear_{side}", ear, tip, r, 0.0, dark, segments=4, flatten=0.5)

    # Arms and legs, built joint to joint so they follow the pose.
    a0, a1 = p["arm_radius"]
    l0, l1 = p["leg_radius"]
    for side, sign in (("l", 1.0), ("r", -1.0)):
        shoulder, elbow, hand = (joints[f"{n}_{side}"] for n in ("shoulder", "elbow", "hand"))
        am = (a0 + a1) / 2
        b.ellipsoid(f"body.shoulder_{side}", shoulder, (a0 * 1.1,) * 3, fur, detail=1)
        b.limb(f"body.upper_arm_{side}", shoulder, elbow, a0, am, fur)
        b.ellipsoid(f"body.elbow_{side}", elbow, (am,) * 3, fur, detail=1)
        b.limb(f"body.forearm_{side}", elbow, hand, am, a1, fur)
        b.ellipsoid(f"body.hand_{side}", hand, (p["hand_radius"],) * 3, dark, detail=1)

        hip, knee, foot = (joints[f"{n}_{side}"] for n in ("hip", "knee", "foot"))
        lm = (l0 + l1) / 2
        b.limb(f"body.thigh_{side}", hip, knee, l0, lm, fur)
        b.ellipsoid(f"body.knee_{side}", knee, (lm,) * 3, fur, detail=1)
        b.limb(f"body.shin_{side}", knee, foot, lm, l1, fur)
        fx, fy, fz = p["foot_size"]
        sole = Vector((foot.x, foot.y - fy * 0.4, fz))
        b.ellipsoid(f"body.foot_{side}", sole, (fx, fy, fz), dark, detail=1)
        for i in (-1, 0, 1):
            claw = sole + Vector((i * fx * 0.5, -fy * 0.82, -fz * 0.35))
            b.limb(
                f"body.claw_{side}_{i + 1}",
                claw,
                claw + Vector((0, -0.07, -0.02)),
                0.03,
                0.0,
                pal["claw"],
                segments=4,
            )

    # Tail.
    if f["tail"] == "stub":
        tail = hips + Vector((0, belly_radii[1] * 0.92, 0.2))
        b.ellipsoid("body.tail", tail, (f["tail_size"],) * 3, dark, detail=1)
    elif f["tail"] == "long":
        base = hips + Vector((0, belly_radii[1] * 0.85, 0.15))
        tip = base + Vector((0.1, f["tail_size"] * 0.7, -f["tail_size"] * 0.6))
        b.limb("body.tail", base, tip, 0.06, 0.03, fur)
