"""Builds the animal's body from a race config. Every race uses the same parts."""

from mathutils import Matrix, Vector

from .materials import Palette
from .mesh import Builder


def build_body(
    b: Builder, race: dict, joints: dict[str, Vector], head_turn: Matrix, pal: Palette
) -> None:
    p, f = race["proportions"], race["features"]
    fur, dark, light = pal["fur"], pal["fur_dark"], pal["fur_light"]
    hips, chest, neck, head = joints["hips"], joints["chest"], joints["neck"], joints["head"]

    def on_head(x: float, y: float, z: float) -> Vector:
        """A point given relative to the head, following the way the head is turned."""
        return head + head_turn.to_3x3() @ Vector((x, y, z))

    # Torso: a belly and a chest, and for heavy races a hump behind the shoulders.
    belly_radii = p["belly_radii"]
    b.attach("hips")
    b.ellipsoid("body.belly", hips + Vector((0, -0.02, belly_radii[2] * 0.5)), belly_radii, fur)
    b.attach("chest")
    b.ellipsoid("body.chest", chest, p["chest_radii"], fur)
    hump = f.get("hump", 0.0)
    if hump > 0:
        b.ellipsoid(
            "body.hump",
            neck + Vector((0, p["chest_radii"][1] * 0.5, -0.1)),
            (p["chest_radii"][0] * 0.72, p["chest_radii"][1] * 0.72, hump + 0.16),
            fur,
        )
    b.limb("body.neck", neck - Vector((0, 0, 0.14)), head, p["neck_radius"], p["neck_radius"] * 0.92, fur)

    # Head: skull, cheeks, muzzle, jaw, nose, eyes, brow and ears.
    b.attach("head")
    hx, hy, hz = p["head_radii"]
    b.ellipsoid("body.head", head, (hx, hy, hz), fur, rotation=head_turn)
    cheek = f.get("cheek_radius", 0.0)
    mx, my, mz = f["muzzle_radii"]
    muzzle_y = -(hy * 0.72 + my * 0.45)
    muzzle = on_head(0, muzzle_y, -f["muzzle_drop"])
    b.ellipsoid("body.muzzle", muzzle, (mx, my, mz), light, rotation=head_turn)
    b.ellipsoid(
        "body.jaw",
        on_head(0, muzzle_y + my * 0.12, -f["muzzle_drop"] - mz * 0.78),
        (mx * 0.82, my * 0.86, mz * 0.5),
        fur,
        detail=1,
        rotation=head_turn,
    )
    b.ellipsoid(
        "body.nose",
        on_head(0, muzzle_y - my * 0.84, -f["muzzle_drop"] + mz * 0.45),
        (mx * 0.5, my * 0.26, mz * 0.48),
        pal["nose"],
        detail=1,
        rotation=head_turn,
    )
    if f.get("fangs"):
        for sign in (1.0, -1.0):
            root = on_head(sign * mx * 0.5, muzzle_y - my * 0.6, -f["muzzle_drop"] - mz * 0.5)
            tip = on_head(sign * mx * 0.5, muzzle_y - my * 0.66, -f["muzzle_drop"] - mz * 1.3)
            b.limb(f"body.fang_{'l' if sign > 0 else 'r'}", root, tip, 0.032, 0.0, pal["claw"], 4)

    brow = f.get("brow", 0.0)
    for side, sign in (("l", 1.0), ("r", -1.0)):
        if cheek > 0:
            b.ellipsoid(
                f"body.cheek_{side}",
                on_head(sign * hx * 0.78, -hy * 0.2, -hz * 0.42),
                (cheek, cheek * 1.05, cheek * 0.95),
                fur,
                detail=1,
                rotation=head_turn,
            )
        eye = on_head(sign * hx * 0.42, -hy * 0.9, hz * 0.06)
        b.ellipsoid(f"body.eye_{side}", eye, (0.05, 0.03, 0.04), pal["eye"], detail=1, rotation=head_turn)
        if brow > 0:
            # A heavy brow that slopes down towards the nose: a scowl.
            slope = Matrix.Rotation(sign * brow * 0.6, 4, "Y")
            b.box(
                f"body.brow_{side}",
                on_head(sign * hx * 0.42, -hy * 0.92, hz * 0.26),
                (hx * 0.55, 0.1, 0.075),
                dark,
                head_turn @ slope,
            )

        r = f["ear_radius"]
        ear = on_head(sign * hx * f["ear_spread"], hy * 0.1, hz * f["ear_height"])
        if f["ear"] == "round":
            b.ellipsoid(f"body.ear_{side}", ear, (r, r * 0.5, r), dark, detail=1, rotation=head_turn)
            b.ellipsoid(
                f"body.ear_inner_{side}",
                on_head(sign * hx * f["ear_spread"], hy * 0.1 - r * 0.3, hz * f["ear_height"]),
                (r * 0.55, r * 0.3, r * 0.55),
                light,
                detail=1,
                rotation=head_turn,
            )
        else:  # pointed
            tip = on_head(sign * (hx * f["ear_spread"] + r * 0.4), hy * 0.1, hz * f["ear_height"] + r * 2)
            b.limb(f"body.ear_{side}", ear, tip, r, 0.0, dark, segments=4, flatten=0.5)

    # Arms and legs, built joint to joint so they follow the pose.
    a0, a1 = p["arm_radius"]
    l0, l1 = p["leg_radius"]
    for side, sign in (("l", 1.0), ("r", -1.0)):
        shoulder, elbow, hand = (joints[f"{n}_{side}"] for n in ("shoulder", "elbow", "hand"))
        am = (a0 + a1) / 2
        b.attach(f"upper_arm_{side}")
        b.ellipsoid(f"body.shoulder_{side}", shoulder, (a0 * 1.12,) * 3, fur, detail=1)
        b.limb(f"body.upper_arm_{side}", shoulder, elbow, a0, am, fur)
        b.attach(f"forearm_{side}")
        b.ellipsoid(f"body.elbow_{side}", elbow, (am * 1.02,) * 3, fur, detail=1)
        b.limb(f"body.forearm_{side}", elbow, hand, am, a1, fur)
        b.attach(f"hand_{side}")
        b.ellipsoid(f"body.hand_{side}", hand, (p["hand_radius"],) * 3, dark, detail=1)

        hip, knee, foot = (joints[f"{n}_{side}"] for n in ("hip", "knee", "foot"))
        lm = (l0 + l1) / 2
        b.attach(f"thigh_{side}")
        b.limb(f"body.thigh_{side}", hip, knee, l0, lm, fur)
        b.attach(f"shin_{side}")
        b.ellipsoid(f"body.knee_{side}", knee, (lm * 1.02,) * 3, fur, detail=1)
        b.limb(f"body.shin_{side}", knee, foot, lm, l1, fur)
        fx, fy, fz = p["foot_size"]
        b.attach(f"foot_{side}")
        sole = Vector((foot.x, foot.y - fy * 0.4, fz))
        b.ellipsoid(f"body.foot_{side}", sole, (fx, fy, fz), dark, detail=1)
        for i in (-1, 0, 1):
            claw = sole + Vector((i * fx * 0.5, -fy * 0.8, -fz * 0.3))
            b.limb(
                f"body.claw_{side}_{i + 1}",
                claw,
                claw + Vector((0, -0.1, -0.03)),
                0.04,
                0.0,
                pal["claw"],
                segments=4,
            )

    # Tail.
    b.attach("hips")
    if f["tail"] == "stub":
        tail = hips + Vector((0, belly_radii[1] * 0.92, 0.2))
        b.ellipsoid("body.tail", tail, (f["tail_size"],) * 3, dark, detail=1)
    elif f["tail"] == "long":
        base = hips + Vector((0, belly_radii[1] * 0.85, 0.15))
        tip = base + Vector((0.1, f["tail_size"] * 0.7, -f["tail_size"] * 0.6))
        b.limb("body.tail", base, tip, 0.06, 0.03, fur)
