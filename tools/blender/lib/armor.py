"""Armour parts. Each is separate and optional, and sized from the race's proportions."""

import math

from mathutils import Matrix, Vector

from .emblem import build_emblem
from .materials import Palette
from .mesh import Builder, frame


def build_armor(
    b: Builder,
    race: dict,
    unit: dict,
    joints: dict[str, Vector],
    head_turn: Matrix,
    pal: Palette,
    emblem: dict | None = None,
) -> None:
    p = race["proportions"]
    armor = unit.get("armor", {})
    hips, chest, neck, head = joints["hips"], joints["chest"], joints["neck"], joints["head"]
    bx, by, bz = p["belly_radii"]
    cx, cy, cz = p["chest_radii"]
    a0, a1 = p["arm_radius"]
    l0, l1 = p["leg_radius"]
    am, lm = (a0 + a1) / 2, (l0 + l1) / 2
    belly = hips + Vector((0, -0.02, bz * 0.5))
    skirt = armor.get("skirt_length", 0.22)

    def on_head(x: float, y: float, z: float) -> Vector:
        return head + head_turn.to_3x3() @ Vector((x, y, z))

    def front(x: float, z: float) -> float:
        """How far forward (-Y) the clothed torso reaches at a point across and up the body."""
        best = hips.y
        for centre, (rx, ry, rz) in ((belly, (bx, by, bz)), (chest, (cx, cy, cz))):
            inside = 1.0 - ((x - centre.x) / rx) ** 2 - ((z - centre.z) / rz) ** 2
            if inside > 0:
                best = min(best, centre.y - ry * 1.06 * math.sqrt(inside))
        return best

    if armor.get("tunic"):
        # A cloth shirt in the team colour: over the belly and chest, down into a skirt, with short sleeves.
        b.attach("hips")
        b.ellipsoid("armor.tunic_body", belly, (bx * 1.04, by * 1.04, bz * 1.03), pal["team"])
        top = hips + Vector((0, -0.02, 0.16))
        hem = hips + Vector((0, -0.02, -skirt))
        b.limb("armor.tunic_skirt", top, hem, bx * 0.98, bx * 1.14, pal["team"], 12, by / bx)
        b.attach("chest")
        b.ellipsoid("armor.tunic_chest", chest, (cx * 1.04, cy * 1.05, cz * 1.03), pal["team"])
        for side in ("l", "r"):
            shoulder, elbow = joints[f"shoulder_{side}"], joints[f"elbow_{side}"]
            b.attach(f"upper_arm_{side}")
            b.limb(
                f"armor.tunic_sleeve_{side}",
                shoulder,
                shoulder.lerp(elbow, armor.get("sleeve_length", 0.5)),
                a0 * 1.12,
                am * 1.14,
                pal["team"],
            )

    if armor.get("mail"):
        # A mail shirt: over the belly, down into a skirt, out over the upper arms and up the neck.
        b.attach("hips")
        b.ellipsoid("armor.mail_body", belly, (bx * 1.04, by * 1.04, bz * 1.03), pal["mail"])
        top = hips + Vector((0, -0.02, 0.16))
        hem = hips + Vector((0, -0.02, -skirt))
        b.limb("armor.mail_skirt", top, hem, bx * 0.98, bx * 1.16, pal["mail"], 12, by / bx)
        b.attach("chest")
        b.limb(
            "armor.mail_collar",
            neck - Vector((0, 0, 0.12)),
            neck.lerp(head, 0.55),
            p["neck_radius"] * 1.2,
            p["neck_radius"] * 1.06,
            pal["mail"],
            10,
        )
        for side in ("l", "r"):
            shoulder, elbow = joints[f"shoulder_{side}"], joints[f"elbow_{side}"]
            b.attach(f"upper_arm_{side}")
            b.limb(
                f"armor.mail_sleeve_{side}",
                shoulder,
                shoulder.lerp(elbow, armor.get("sleeve_length", 0.7)),
                a0 * 1.14,
                am * 1.16,
                pal["mail"],
            )

    if armor.get("cuirass"):
        b.attach("chest")
        b.ellipsoid("armor.cuirass", chest, (cx * 1.06, cy * 1.08, cz * 1.05), pal["steel"])
        # Overlapping bands of plate down the belly.
        b.attach("hips")
        for i in range(armor.get("lames", 0)):
            middle = hips + Vector((0, -0.02, bz * (1.0 - i * 0.36)))
            b.limb(
                f"armor.lame_{i}",
                middle + Vector((0, 0, 0.09)),
                middle - Vector((0, 0, 0.09)),
                bx * (1.03 - i * 0.015),
                bx * (1.1 - i * 0.015),
                pal["steel"] if i % 2 == 0 else pal["steel_dark"],
                12,
                by / bx,
            )

    if armor.get("tassets"):
        # Plates hanging from the belt over the mail skirt: two in front, one on each hip.
        height = skirt + 0.1
        b.attach("hips")
        z = hips.z + 0.12 - height / 2
        for side, sign in (("l", 1.0), ("r", -1.0)):
            lean = Matrix.Rotation(-0.22, 4, "X")
            b.box(
                f"armor.tasset_front_{side}",
                Vector((sign * bx * 0.62, -by * 1.12, z)),
                (bx * 0.5, 0.06, height),
                pal["steel"],
                Matrix.Rotation(sign * 0.35, 4, "Z") @ lean,
            )
            b.box(
                f"armor.tasset_hip_{side}",
                Vector((sign * bx * 1.16, 0.0, z)),
                (0.06, by * 0.95, height),
                pal["steel_dark"],
                Matrix.Rotation(sign * 0.2, 4, "Y"),
            )

    if armor.get("pauldrons"):
        for side, sign in (("l", 1.0), ("r", -1.0)):
            centre = joints[f"shoulder_{side}"] + Vector((sign * 0.05, 0, 0.06))
            b.attach("chest")
            b.ellipsoid(
                f"armor.pauldron_{side}",
                centre,
                (a0 * 1.5, a0 * 1.45, a0 * 1.15),
                pal["steel"],
                rotation=frame((sign * 0.45, 0, 1.0)),
                keep_above=-0.25,
            )
            # A second plate under the first, further down the arm.
            b.attach(f"upper_arm_{side}")
            b.ellipsoid(
                f"armor.pauldron_lower_{side}",
                centre + Vector((sign * a0 * 0.62, 0, -a0 * 0.55)),
                (a0 * 1.22, a0 * 1.3, a0 * 0.95),
                pal["steel_dark"],
                rotation=frame((sign * 1.0, 0, 0.75)),
                keep_above=-0.15,
            )
            if armor.get("pauldron_spikes"):
                b.attach("chest")
                root = centre + Vector((sign * a0 * 0.45, 0, a0 * 0.85))
                tip = root + Vector((sign * a0 * 0.75, 0, a0 * 1.25))
                b.limb(f"armor.pauldron_spike_{side}", root, tip, a0 * 0.4, 0.0, pal["brass"], 6)

    if armor.get("fur_collar"):
        # A thick pelt around the back of the neck and over the shoulders.
        b.attach("chest")
        for i, angle in enumerate((-80, -45, -15, 15, 45, 80)):
            a = math.radians(angle)
            tuft = neck + Vector((math.sin(a) * cx * 0.66, math.cos(a) * cy * 0.62 + 0.04, 0.02))
            size = 0.2 + 0.03 * (i % 2)
            b.ellipsoid(f"armor.fur_collar_{i}", tuft, (size, size, size * 0.8), pal["fur_dark"], detail=1)

    if armor.get("bracers"):
        for side in ("l", "r"):
            elbow, hand = joints[f"elbow_{side}"], joints[f"hand_{side}"]
            b.attach(f"forearm_{side}")
            b.limb(
                f"armor.bracer_{side}",
                elbow.lerp(hand, 0.28),
                elbow.lerp(hand, 0.84),
                am * 1.22,
                a1 * 1.22,
                pal["steel"],
            )
            b.ellipsoid(f"armor.elbow_{side}", elbow, (am * 1.2,) * 3, pal["steel_dark"], detail=1)

    if armor.get("greaves"):
        for side in ("l", "r"):
            knee, foot = joints[f"knee_{side}"], joints[f"foot_{side}"]
            b.attach(f"shin_{side}")
            b.limb(f"armor.greave_{side}", knee, foot.lerp(knee, 0.1), lm * 1.2, l1 * 1.22, pal["steel"])
            cap = knee + Vector((0, -lm * 0.55, 0.02))
            b.ellipsoid(f"armor.knee_{side}", cap, (lm * 0.95, lm * 0.8, lm * 0.95), pal["steel_dark"], detail=1)
            if armor.get("knee_spikes"):
                b.limb(
                    f"armor.knee_spike_{side}",
                    cap + Vector((0, -lm * 0.5, 0)),
                    cap + Vector((0, -lm * 1.5, lm * 0.5)),
                    lm * 0.4,
                    0.0,
                    pal["brass"],
                    4,
                )

    if armor.get("wraps"):
        # Leather wrapped around the forearms and the shins.
        for side in ("l", "r"):
            elbow, hand = joints[f"elbow_{side}"], joints[f"hand_{side}"]
            b.attach(f"forearm_{side}")
            b.limb(
                f"armor.wrap_arm_{side}",
                elbow.lerp(hand, 0.3),
                elbow.lerp(hand, 0.86),
                am * 1.14,
                a1 * 1.16,
                pal["leather"],
            )
            knee, foot = joints[f"knee_{side}"], joints[f"foot_{side}"]
            b.attach(f"shin_{side}")
            b.limb(
                f"armor.wrap_leg_{side}",
                knee.lerp(foot, 0.25),
                foot.lerp(knee, 0.1),
                lm * 1.12,
                l1 * 1.16,
                pal["leather"],
            )

    guard = armor.get("shoulder_guard")
    if guard:
        # One thick leather plate over a shoulder, with a brass stud.
        side, sign = ("l", 1.0) if guard == "left" else ("r", -1.0)
        centre = joints[f"shoulder_{side}"] + Vector((sign * 0.05, 0, 0.06))
        b.attach("chest")
        b.ellipsoid(
            f"armor.shoulder_guard_{side}",
            centre,
            (a0 * 1.45, a0 * 1.4, a0 * 1.1),
            pal["leather"],
            rotation=frame((sign * 0.45, 0, 1.0)),
            keep_above=-0.25,
        )
        stud = centre + Vector((sign * a0 * 0.5, 0, a0 * 0.95))
        b.ellipsoid(f"armor.shoulder_stud_{side}", stud, (a0 * 0.3,) * 3, pal["brass"], detail=1)

    if armor.get("apron"):
        # A leather work apron hanging from the belt down past the hem of the skirt.
        b.attach("hips")
        y = -by * 1.2
        top_z, low_z = hips.z + 0.14, hips.z - skirt - 0.1
        rows = []
        for t in (0.0, 0.5, 1.0):
            z = top_z + (low_z - top_z) * t
            half = bx * (0.62 + 0.14 * t)
            out = y - 0.07 * t
            rows.append([(-half, out + 0.1, z), (-half * 0.5, out, z), (half * 0.5, out, z), (half, out + 0.1, z)])
        b.sheet("armor.apron", rows, pal["leather"])

    if armor.get("basket"):
        # A wicker basket carried on the back, with straps over the shoulders.
        b.attach("chest")
        low, high = armor.get("basket_radii", (0.27, 0.37))
        squeeze = 0.82
        middle_y = chest.y + cy * 0.95 + high * squeeze
        bottom = Vector((0.0, middle_y - 0.04, hips.z + 0.18))
        rim = Vector((0.0, middle_y + 0.06, neck.z + 0.12))
        b.limb("armor.basket", bottom, rim, low, high, pal["wicker"], 12, squeeze)
        for i, t in enumerate((0.3, 0.62)):
            at = bottom.lerp(rim, t)
            width = low + (high - low) * t
            step = (rim - bottom).normalized() * 0.035
            b.limb(f"armor.basket_band_{i}", at - step, at + step, width * 1.04, width * 1.05, pal["wicker_dark"], 12, squeeze)
        lip = (rim - bottom).normalized() * 0.05
        b.limb("armor.basket_rim", rim - lip, rim + lip, high * 1.08, high * 1.1, pal["wicker_dark"], 12, squeeze)
        # The dark inside of the basket, seen from above.
        b.limb("armor.basket_inside", rim + lip, rim + lip * 1.15, high * 0.92, high * 0.92, pal["fur_dark"], 12, squeeze)
        axis = (rim - bottom).normalized()
        for kind in armor.get("basket_loads", []):
            # What the basket can be filled with. Each is a layer of its own in
            # the sprites (see [[layer]] in the unit's config), shown by the game
            # when the unit carries that resource.
            if kind == "wood":
                # Split logs standing in the basket.
                logs = ((-0.14, -0.05, 0.34, 0.11), (0.12, -0.08, 0.26, 0.12), (0.0, 0.1, 0.42, 0.1), (0.15, 0.1, 0.2, 0.09))
                for i, (x, y, above, radius) in enumerate(logs):
                    foot = rim + Vector((x, y * squeeze, 0.0)) - axis * 0.25
                    head = rim + Vector((x * 1.25, y * squeeze, 0.0)) + axis * above
                    b.limb(f"load.wood.log_{i}", foot, head, radius, radius, pal["log"], 6)
                    b.limb(f"load.wood.log_end_{i}", head, head + axis * 0.02, radius * 0.86, radius * 0.86, pal["log_end"], 6)
            elif kind == "food":
                # A heap of berries.
                b.ellipsoid(
                    "load.food.heap",
                    rim + axis * 0.04,
                    (high * 0.9, high * 0.9 * squeeze, 0.2),
                    pal["berry"],
                    detail=1,
                    keep_above=-0.1,
                )
                berries = ((0.0, 0.0, 0.2), (-0.17, -0.05, 0.13), (0.16, 0.06, 0.14), (0.04, -0.14, 0.12), (-0.05, 0.15, 0.13))
                for i, (x, y, z) in enumerate(berries):
                    at = rim + Vector((x, y * squeeze, 0.0)) + axis * (0.04 + z)
                    b.ellipsoid(f"load.food.berry_{i}", at, (0.1,) * 3, pal["berry_light" if i % 2 else "berry"], detail=1)
            else:
                raise ValueError(f"Unknown basket load {kind!r}")
        for side, sign in (("l", 1.0), ("r", -1.0)):
            x = sign * cx * 0.5
            rows = []
            for t in (0.0, 0.2, 0.45, 0.7, 1.0):
                z = chest.z + cz * (0.78 - 1.3 * t)
                across = x + sign * cx * 0.16 * t
                y = front(across, z) - 0.03
                rows.append([(across - 0.055, y, z), (across + 0.055, y, z)])
            b.sheet(f"armor.basket_strap_{side}", rows, pal["leather"])

    if armor.get("harness"):
        # Two leather straps crossing the chest and the back, with a brass disc where they meet in front.
        b.attach("chest")

        def skin(x: float, z: float, toward: float) -> float:
            """Where the chest's surface is at a point across and up it; `toward` is -1 for the front, 1 for the back."""
            inside = max(0.0, 1.0 - (x / cx) ** 2 - ((z - chest.z) / cz) ** 2)
            return chest.y + toward * (cy * 1.04 * math.sqrt(inside) + 0.03)

        for face, toward in (("front", -1.0), ("back", 1.0)):
            for side, sign in (("l", 1.0), ("r", -1.0)):
                rows = []
                for t in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0):
                    x = sign * cx * (0.6 - 1.15 * t)
                    z = chest.z + cz * (0.66 - 1.3 * t)
                    y = skin(x, z, toward)
                    rows.append([(x - 0.05, y, z + 0.03), (x + 0.05, y, z - 0.03)])
                b.sheet(f"armor.harness_{face}_{side}", rows, pal["leather"])
        middle = Vector((0.0, skin(0.0, chest.z + cz * 0.01, -1.0), chest.z + cz * 0.01))
        b.limb("armor.harness_disc", middle, middle + Vector((0, -0.04, 0)), 0.12, 0.1, pal["brass"], 10)

    if armor.get("sash"):
        # A wide cloth in the team colour wound around the waist, with one end hanging at the hip.
        b.attach("hips")
        waist = hips + Vector((0, -0.02, 0.2))
        b.limb("armor.sash", waist - Vector((0, 0, 0.09)), waist + Vector((0, 0, 0.09)), bx * 1.1, bx * 1.06, pal["team"], 12, by / bx)
        knot = waist + Vector((bx * 0.95, -by * 0.35, 0.0))
        b.ellipsoid("armor.sash_knot", knot, (0.09, 0.09, 0.09), pal["team"], detail=1)
        b.limb("armor.sash_end", knot, knot + Vector((0.1, -0.02, -0.5)), 0.085, 0.05, pal["team"], 6, 0.4)

    if armor.get("headband"):
        # A band in the team colour around the brow, knotted behind with two tails.
        hx, hy, hz = p["head_radii"]
        b.attach("head")
        up = tuple(head_turn.to_3x3() @ Vector((1, 0, 0)))
        b.limb(
            "armor.headband",
            on_head(0, 0.0, hz * 0.3),
            on_head(0, 0.0, hz * 0.5),
            hx * 1.05,
            hx * 0.99,
            pal["team"],
            12,
            hy / hx,
            up,
        )
        knot = on_head(0, hy * 1.02, hz * 0.38)
        b.ellipsoid("armor.headband_knot", knot, (0.06, 0.06, 0.06), pal["team"], detail=1)
        for side, sign in (("l", 1.0), ("r", -1.0)):
            tip = on_head(sign * 0.12, hy * 1.5, -hz * 0.7)
            b.limb(f"armor.headband_tail_{side}", knot, tip, 0.05, 0.025, pal["team"], 6, 0.4)

    if armor.get("belt"):
        middle = hips + Vector((0, -0.02, 0.16))
        b.attach("hips")
        b.limb(
            "armor.belt",
            middle - Vector((0, 0, 0.065)),
            middle + Vector((0, 0, 0.065)),
            bx * 1.14,
            bx * 1.13,
            pal["leather"],
            12,
            by / bx,
        )
        b.box("armor.buckle", middle + Vector((0, -by * 1.15, 0)), (0.16, 0.06, 0.16), pal["brass"])

    if armor.get("tabard"):
        # A strip of cloth in the team colour, hanging from the belt and ending in a point.
        y, w = -by * 1.17, 0.19
        b.attach("hips")
        top_z, low_z = hips.z + 0.14, hips.z - skirt - 0.2
        rows = [
            [(-w, y, top_z), (0, y - 0.02, top_z), (w, y, top_z)],
            [(-w, y - 0.09, low_z + 0.18), (0, y - 0.12, low_z + 0.16), (w, y - 0.09, low_z + 0.18)],
            [(-w * 0.1, y - 0.11, low_z), (0, y - 0.12, low_z - 0.02), (w * 0.1, y - 0.11, low_z)],
        ]
        b.sheet("armor.tabard", rows, pal["team"])

    helmet = armor.get("helmet")
    if helmet:
        # A tall, rounded helmet that leaves the muzzle and the ears free.
        hx, hy, hz = p["head_radii"]
        b.attach("head")
        rim = 0.34  # how far up the dome the rim is cut, 0 = its middle, 1 = its top
        tall = hz * 1.42
        b.ellipsoid(
            "armor.helmet",
            on_head(0, 0.01, 0.0),
            (hx * 1.1, hy * 1.1, tall),
            pal["steel"],
            rotation=head_turn,
            keep_above=rim,
        )
        b.limb(
            "armor.helmet_band",
            on_head(0, 0.01, tall * (rim - 0.04)),
            on_head(0, 0.01, tall * (rim + 0.1)),
            hx * 1.1,
            hx * 1.07,
            pal["steel_dark"],
            12,
            hy / hx,
        )
        # A brow plate that shades the eyes, and plates down the cheeks.
        b.box(
            "armor.helmet_brow",
            on_head(0, -hy * 0.98, tall * rim + 0.02),
            (hx * 1.5, 0.12, 0.1),
            pal["steel_dark"],
            head_turn,
        )
        for side, sign in (("l", 1.0), ("r", -1.0)):
            b.box(
                f"armor.helmet_cheek_{side}",
                on_head(sign * hx * 1.02, -hy * 0.3, -hz * 0.12),
                (0.07, hy * 0.75, hz * 0.8),
                pal["steel"],
                head_turn @ Matrix.Rotation(sign * 0.12, 4, "Y"),
            )
        if helmet == "nasal":
            b.box(
                "armor.helmet_nasal",
                on_head(0, -hy * 1.04, tall * rim - hz * 0.2),
                (0.08, 0.07, hz * 0.6),
                pal["steel_dark"],
                head_turn,
            )
        up = tuple(head_turn.to_3x3() @ Vector((0, 0, 1)))
        if armor.get("crest"):
            # A stiff crest in the team colour, from the brow over the crown to the neck.
            arc = (
                (on_head(0, -hy * 1.02, tall * 0.66), 0.06),
                (on_head(0, -hy * 0.5, tall * 0.98), 0.2),
                (on_head(0, hy * 0.35, tall * 1.0), 0.24),
                (on_head(0, hy * 1.0, tall * 0.72), 0.2),
                (on_head(0, hy * 1.35, tall * 0.34), 0.1),
            )
            for i, ((start, r0), (end, r1)) in enumerate(zip(arc, arc[1:])):
                b.limb(f"armor.crest_{i}", start, end, r0, r1, pal["team"], 4, 0.3, up)
        else:
            crown = on_head(0, 0.01, tall * 0.97)
            b.limb("armor.helmet_spike", crown, on_head(0, 0.01, tall * 0.97 + 0.2), 0.08, 0.0, pal["brass"], 6)

    if armor.get("cape"):
        # The cape hangs from the shoulders down the back, in the team colour, with a ragged hem.
        half = p["shoulder_half_width"]
        b.attach("cape")
        back = cy * 1.02
        length = armor.get("cape_length", 1.0)
        top_z = neck.z - 0.06
        ragged = (0.0, 0.11, -0.03, 0.13, 0.02, 0.1, 0.0) if armor.get("cape_ragged") else (0.0,) * 7
        rows = []
        across = (-1.0, -0.66, -0.33, 0.0, 0.33, 0.66, 1.0)
        down = (0.0, 0.25, 0.6, 1.0)

        def cape_width(t: float) -> float:
            return half * (0.78 + 0.5 * t)

        for t in down:
            z = top_z - t * length
            width = cape_width(t)
            # It follows the back and belly, then flares out a little at the hem.
            away = back + 0.1 * (t * 2.2 if t < 0.45 else 1.0) + 0.14 * max(0.0, t - 0.6)
            wrap = 0.05 + 0.06 * t
            row = []
            for i, u in enumerate(across):
                bend = away - wrap * u * u + 0.03 * (1 - abs(u))
                lift = ragged[i] if t == 1.0 else 0.0
                row.append((width * u, bend, z + lift))
            rows.append(row)
        b.sheet("armor.cape", rows, pal["team"])

        if emblem and armor.get("cape_emblem"):
            # The race's sigil on the back of the cape, following its curve.
            smooth_rows = [[Vector(point) for point in row] for row in rows]
            for i in range(len(across)):
                # The ragged hem is left out, so the sigil lies on an even surface.
                smooth_rows[-1][i].z = top_z - length

            def on_cape(u: float, t: float) -> Vector:
                ci = max(i for i in range(len(across) - 1) if across[i] <= u or i == 0)
                ri = max(i for i in range(len(down) - 1) if down[i] <= t or i == 0)
                fu = (u - across[ci]) / (across[ci + 1] - across[ci])
                ft = (t - down[ri]) / (down[ri + 1] - down[ri])
                upper = smooth_rows[ri][ci].lerp(smooth_rows[ri][ci + 1], fu)
                lower = smooth_rows[ri + 1][ci].lerp(smooth_rows[ri + 1][ci + 1], fu)
                return upper.lerp(lower, ft)

            middle = armor.get("cape_emblem_at", 0.45)
            reach = cape_width(middle) * armor.get("cape_emblem_size", 0.6)

            def place(x: float, y: float, height: float) -> Vector:
                t = min(0.98, max(0.02, middle - y * reach / length))
                # Seen from behind, the figure's left is on the right: flip so the sigil is not mirrored.
                u = min(0.98, max(-0.98, -x * reach / cape_width(t)))
                return on_cape(u, t) + Vector((0.0, height, 0.0))

            build_emblem(b, "armor.cape_emblem", emblem, place, pal)
        if not armor.get("fur_collar"):
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
