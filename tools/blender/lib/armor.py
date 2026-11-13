"""Armour parts. Each is separate and optional, and sized from the race's proportions."""

from mathutils import Vector

from .materials import Palette
from .mesh import Builder, frame


def build_armor(b: Builder, race: dict, unit: dict, joints: dict[str, Vector], pal: Palette) -> None:
    p = race["proportions"]
    armor = unit.get("armor", {})
    hips, chest, neck, head = joints["hips"], joints["chest"], joints["neck"], joints["head"]
    bx, by, bz = p["belly_radii"]
    cx, cy, cz = p["chest_radii"]
    a0, a1 = p["arm_radius"]
    l0, l1 = p["leg_radius"]
    am, lm = (a0 + a1) / 2, (l0 + l1) / 2
    belly = hips + Vector((0, -0.02, bz * 0.5))

    if armor.get("mail"):
        # A mail shirt: over the belly, down into a skirt, and out over the upper arms.
        b.ellipsoid("armor.mail_body", belly, (bx * 1.05, by * 1.05, bz * 1.03), pal["mail"])
        top = hips + Vector((0, -0.02, 0.16))
        hem = hips + Vector((0, -0.02, -armor.get("skirt_length", 0.22)))
        b.limb("armor.mail_skirt", top, hem, bx * 0.98, bx * 1.14, pal["mail"], 10, by / bx)
        for side in ("l", "r"):
            shoulder, elbow = joints[f"shoulder_{side}"], joints[f"elbow_{side}"]
            b.limb(
                f"armor.mail_sleeve_{side}",
                shoulder,
                shoulder.lerp(elbow, armor.get("sleeve_length", 0.7)),
                a0 * 1.14,
                am * 1.16,
                pal["mail"],
            )

    if armor.get("cuirass"):
        b.ellipsoid("armor.cuirass", chest, (cx * 1.06, cy * 1.07, cz * 1.04), pal["steel"])

    if armor.get("pauldrons"):
        for side, sign in (("l", 1.0), ("r", -1.0)):
            centre = joints[f"shoulder_{side}"] + Vector((sign * 0.04, 0, 0.05))
            tilt = frame((sign * 0.45, 0, 1.0))
            b.ellipsoid(
                f"armor.pauldron_{side}",
                centre,
                (a0 * 1.42, a0 * 1.35, a0 * 1.1),
                pal["steel"],
                rotation=tilt,
                keep_above=-0.25,
            )
            b.ellipsoid(
                f"armor.pauldron_trim_{side}",
                centre + Vector((sign * a0 * 0.2, 0, a0 * 0.75)),
                (a0 * 0.5, a0 * 0.5, a0 * 0.3),
                pal["brass"],
                detail=1,
            )

    if armor.get("bracers"):
        for side in ("l", "r"):
            elbow, hand = joints[f"elbow_{side}"], joints[f"hand_{side}"]
            b.limb(
                f"armor.bracer_{side}",
                elbow.lerp(hand, 0.3),
                elbow.lerp(hand, 0.82),
                am * 1.2,
                a1 * 1.2,
                pal["steel"],
            )

    if armor.get("greaves"):
        for side in ("l", "r"):
            knee, foot = joints[f"knee_{side}"], joints[f"foot_{side}"]
            b.limb(f"armor.greave_{side}", knee, foot.lerp(knee, 0.1), lm * 1.18, l1 * 1.2, pal["steel"])
            b.ellipsoid(
                f"armor.knee_{side}",
                knee + Vector((0, -lm * 0.5, 0.02)),
                (lm * 0.9, lm * 0.75, lm * 0.9),
                pal["steel_dark"],
                detail=1,
            )

    if armor.get("belt"):
        middle = hips + Vector((0, -0.02, 0.2))
        b.limb(
            "armor.belt",
            middle - Vector((0, 0, 0.055)),
            middle + Vector((0, 0, 0.055)),
            bx * 1.1,
            bx * 1.1,
            pal["leather"],
            10,
            by / bx,
        )
        b.box("armor.buckle", middle + Vector((0, -by * 1.1, 0)), (0.13, 0.05, 0.13), pal["brass"])

    if armor.get("tabard"):
        # A strip of cloth in the team colour, hanging from the belt at the front.
        y, w = -by * 1.13, 0.17
        top_z, low_z = hips.z + 0.16, hips.z - armor.get("skirt_length", 0.22) - 0.1
        rows = [
            [(-w, y, top_z), (0, y - 0.02, top_z), (w, y, top_z)],
            [(-w, y - 0.07, low_z + 0.06), (0, y - 0.1, low_z), (w, y - 0.07, low_z + 0.06)],
        ]
        b.sheet("armor.tabard", rows, pal["team"])

    helmet = armor.get("helmet")
    if helmet:
        # A tall, rounded helmet that leaves the face and the ears free.
        hx, hy, hz = p["head_radii"]
        rim = 0.26  # how far up the dome the rim is cut, 0 = its middle, 1 = its top
        tall = hz * 1.42
        b.ellipsoid(
            "armor.helmet",
            head + Vector((0, 0.01, 0.0)),
            (hx * 1.08, hy * 1.08, tall),
            pal["steel"],
            keep_above=rim,
        )
        b.limb(
            "armor.helmet_band",
            head + Vector((0, 0.01, tall * (rim - 0.03))),
            head + Vector((0, 0.01, tall * (rim + 0.1))),
            hx * 1.08,
            hx * 1.05,
            pal["steel_dark"],
            12,
            hy / hx,
        )
        # A short spike on the crown.
        crown = head + Vector((0, 0.01, tall * 0.97))
        b.limb("armor.helmet_spike", crown, crown + Vector((0, 0, 0.17)), 0.075, 0.0, pal["brass"], 6)
        if helmet == "nasal":
            b.box(
                "armor.helmet_nasal",
                head + Vector((0, -hy * 1.03, tall * rim - hz * 0.16)),
                (0.07, 0.06, hz * 0.5),
                pal["steel_dark"],
            )

    if armor.get("cape"):
        # The cape hangs from the shoulders down the back, in the team colour.
        half = p["shoulder_half_width"]
        back = cy * 1.02
        length = armor.get("cape_length", 1.0)
        top_z = neck.z - 0.06
        rows = []
        for t in (0.0, 0.25, 0.6, 1.0):
            z = top_z - t * length
            width = half * (0.72 + 0.42 * t)
            # It follows the back and belly, then flares out a little at the hem.
            away = back + 0.1 * (t * 2.2 if t < 0.45 else 1.0) + 0.1 * max(0.0, t - 0.6)
            wrap = 0.05 + 0.05 * t
            rows.append(
                [
                    (-width, away - wrap, z),
                    (-width * 0.55, away - 0.02, z - 0.03 * t),
                    (0.0, away + 0.03, z),
                    (width * 0.55, away - 0.02, z - 0.03 * t),
                    (width, away - wrap, z),
                ]
            )
        b.sheet("armor.cape", rows, pal["team"])
        # A collar that hides where the cape meets the armour.
        b.limb(
            "armor.cape_collar",
            neck + Vector((0, 0.08, -0.12)),
            neck + Vector((0, 0.05, 0.0)),
            cx * 0.66,
            p["neck_radius"] * 1.2,
            pal["team"],
            10,
            0.8,
        )
