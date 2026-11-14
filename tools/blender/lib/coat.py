"""
A race's coat: markings in the fur, and a long tail. They are separate from
the body so that any race can have them: a race config turns them on under
[markings] and [tail]. Stripes are bands of a second fur colour around the
limbs and the body, in a fixed pattern, so the same config always gives the
same coat.
"""

from mathutils import Matrix, Vector

from .materials import Palette
from .mesh import Builder


def build_coat(b: Builder, race: dict, joints: dict[str, Vector], head_turn: Matrix, pal: Palette) -> None:
    markings = race.get("markings")
    if markings and markings.get("type") == "stripes":
        _stripes(b, race, markings, joints, head_turn, pal)
    tail = race.get("tail")
    if tail:
        _tail(b, race, tail, joints, pal)


def _stripes(b: Builder, race: dict, m: dict, joints, head_turn: Matrix, pal: Palette) -> None:
    p = race["proportions"]
    dark = pal[m.get("color", "stripe")]
    width = m.get("width", 0.05)
    a0, a1 = p["arm_radius"]
    l0, l1 = p["leg_radius"]
    am, lm = (a0 + a1) / 2, (l0 + l1) / 2

    # Bands around the arms and the legs, a little closer together towards the hands and feet.
    limbs = (
        ("upper_arm", "shoulder", "elbow", a0, am, m.get("upper_arm", 2)),
        ("forearm", "elbow", "hand", am, a1, m.get("forearm", 2)),
        ("thigh", "hip", "knee", l0, lm, m.get("thigh", 3)),
        ("shin", "knee", "foot", lm, l1, m.get("shin", 2)),
    )
    for side in ("l", "r"):
        for bone, start, end, r0, r1, count in limbs:
            a, c = joints[f"{start}_{side}"], joints[f"{end}_{side}"]
            along = (c - a).normalized()
            b.attach(f"{bone}_{side}")
            for i in range(count):
                t = (i + 0.7) / (count + 0.4)
                at = a.lerp(c, t)
                r = (r0 + (r1 - r0) * t) * 1.045
                # Every other band is thinner, as in a tiger's coat.
                half = width * (0.5 if i % 2 == 0 else 0.32)
                b.limb(f"body.stripe_{bone}_{side}_{i}", at - along * half, at + along * half, r, r, dark, 8)

    # Bands around the body: the belly follows the hips and the chest the chest.
    for bone, name, centre, radii, heights in (
        ("hips", "belly", joints["hips"] + Vector((0, -0.02, p["belly_radii"][2] * 0.5)), p["belly_radii"], m.get("belly", (-0.35, 0.25))),
        ("chest", "chest", joints["chest"], p["chest_radii"], m.get("chest", (-0.4, 0.05, 0.5))),
    ):
        rx, ry, rz = radii
        b.attach(bone)
        for i, share in enumerate(heights):
            z = centre.z + rz * share
            r = rx * (1 - share * share) ** 0.5 * 1.03
            half = width * (0.5 if i % 2 == 0 else 0.34)
            b.limb(
                f"body.stripe_{name}_{i}",
                (centre.x, centre.y, z - half),
                (centre.x, centre.y, z + half),
                r,
                r,
                dark,
                12,
                ry / rx,
            )

    # Stripes on the head: three over the crown and two on each cheek.
    hx, hy, hz = p["head_radii"]
    head = joints["head"]

    def on_head(x: float, y: float, z: float) -> Vector:
        return head + head_turn.to_3x3() @ Vector((x, y, z))

    b.attach("head")
    for i, x in enumerate((-0.42, 0.0, 0.42)):
        long = 0.5 if x == 0 else 0.36
        b.box(
            f"body.stripe_crown_{i}",
            on_head(x * hx, -hy * 0.18, hz * (0.97 - abs(x) * 0.28)),
            (width * 0.9, hy * long * 2, 0.04),
            dark,
            head_turn @ Matrix.Rotation(-x * 0.9, 4, "Y") @ Matrix.Rotation(0.25, 4, "X"),
        )
    for side, sign in (("l", 1.0), ("r", -1.0)):
        for i, z in enumerate((0.05, -0.3)):
            b.box(
                f"body.stripe_cheek_{side}_{i}",
                on_head(sign * hx * 1.0, -hy * 0.05, hz * z),
                (0.04, hy * 0.75, width * 0.8),
                dark,
                head_turn @ Matrix.Rotation(sign * 0.35, 4, "Z"),
            )


def _tail(b: Builder, race: dict, t: dict, joints, pal: Palette) -> None:
    """A long tail in segments: it hangs from the hips, sweeps back and curls up at the tip."""
    p = race["proportions"]
    fur, dark = pal["fur"], pal[t.get("color", "stripe")]
    length = t["length"]
    r0, r1 = t.get("radius", (0.07, 0.045))
    base = joints["hips"] + Vector((0.0, p["belly_radii"][1] * 0.8, 0.12))
    # The shape of the tail, as steps of its length: back and down, then up into a curl.
    steps = ((0.0, 0.16, -0.10), (0.02, 0.17, -0.13), (0.04, 0.17, -0.10), (0.05, 0.15, -0.02), (0.05, 0.11, 0.07), (0.03, 0.05, 0.10))
    b.attach("hips")
    at = base
    for i, step in enumerate(steps):
        nxt = at + Vector(step) * (length / 0.6)
        share = i / (len(steps) - 1)
        r = r0 + (r1 - r0) * share
        last = i == len(steps) - 1
        # Rings of the darker colour down the tail, and a dark tip.
        material = dark if (i % 2 == 1 or last) else fur
        b.limb(f"body.tail_{i}", at, nxt, r, r * (0.6 if last else 0.94), material, 8)
        b.ellipsoid(f"body.tail_joint_{i}", at, (r * 1.02,) * 3, material, detail=1)
        at = nxt
