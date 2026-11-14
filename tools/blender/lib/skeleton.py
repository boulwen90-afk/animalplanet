"""
The skeleton shared by every race.

All races have the same bones with the same names, so one library of
animations serves them all. Only the lengths differ, and they come from the
race's proportions. A pose says which way each limb points, where the feet
are and how the torso and head are turned; `solve` turns that into a place and
an orientation for every bone.

The figure stands on z = 0 and faces -Y. Its left side is +X ("_l"), its right
side is -X ("_r").
"""

import math
from dataclasses import dataclass, field

import bpy
from mathutils import Matrix, Vector

from .mesh import frame

# Every bone and its parent, parents first.
BONES: tuple[tuple[str, str | None], ...] = (
    ("root", None),
    ("hips", "root"),
    ("chest", "hips"),
    ("cape", "chest"),
    ("head", "chest"),
    ("upper_arm_l", "chest"),
    ("forearm_l", "upper_arm_l"),
    ("hand_l", "forearm_l"),
    ("upper_arm_r", "chest"),
    ("forearm_r", "upper_arm_r"),
    ("hand_r", "forearm_r"),
    ("thigh_l", "hips"),
    ("shin_l", "thigh_l"),
    ("foot_l", "shin_l"),
    ("thigh_r", "hips"),
    ("shin_r", "thigh_r"),
    ("foot_r", "shin_r"),
)

# What a pose holds when nothing else is said: arms and legs hang straight down.
DEFAULT_POSE: dict = {
    "hips_offset": (0.0, 0.0, 0.0),      # the hips moved from where they stand at rest
    "hips_turn": (0.0, 0.0, 0.0),        # pitch, roll, yaw in degrees
    "chest_turn": (0.0, 0.0, 0.0),       # pitch (positive leans forward), roll, yaw
    "head_turn": (0.0, 0.0, 0.0),        # relative to the chest; positive pitch lowers the muzzle
    "upper_arm_l": (0.15, 0.0, -1.0),    # which way each part of a limb points
    "forearm_l": (0.05, -0.1, -1.0),
    "upper_arm_r": (-0.15, 0.0, -1.0),
    "forearm_r": (-0.05, -0.1, -1.0),
    "thigh_l": (0.06, -0.04, -1.0),
    "shin_l": (0.02, 0.06, -1.0),
    "thigh_r": (-0.06, -0.04, -1.0),
    "shin_r": (-0.02, 0.06, -1.0),
    "foot_l": None,                      # where the ankle is; overrides thigh and shin when given
    "foot_r": None,
    "foot_pitch_l": 0.0,                 # degrees; positive points the toes down
    "foot_pitch_r": 0.0,
    "weapon_dir": (0.0, -0.3, 1.0),      # where the blade points
    "weapon_flat": (1.0, 0.0, 0.0),      # the direction the blade is wide along
    "shield_normal": (0.0, -1.0, 0.0),   # the way the face of the shield points
    "cape_swing": 0.0,                   # degrees the cape trails out behind
}


def turn(pitch_roll_yaw) -> Matrix:
    """A rotation from pitch, roll and yaw in degrees. Positive pitch tips the front (-Y) down."""
    pitch, roll, yaw = (math.radians(a) for a in pitch_roll_yaw)
    return (
        Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(pitch, 4, "X") @ Matrix.Rotation(roll, 4, "Y")
    )


def full_pose(pose: dict | None) -> dict:
    """A pose with every value filled in. `head_pitch_deg` is an older way to lower the head."""
    given = dict(pose or {})
    if "head_pitch_deg" in given:
        given.setdefault("head_turn", (given.pop("head_pitch_deg"), 0.0, 0.0))
    unknown = set(given) - set(DEFAULT_POSE)
    if unknown:
        raise KeyError(f"Unknown pose values: {sorted(unknown)}")
    return {**DEFAULT_POSE, **given}


@dataclass
class Skeleton:
    """Where every joint is and how every bone is turned, for one pose."""

    joints: dict[str, Vector] = field(default_factory=dict)
    bones: dict[str, Matrix] = field(default_factory=dict)
    head_turn: Matrix = field(default_factory=lambda: Matrix.Identity(4))


def _place(origin: Vector, rotation: Matrix) -> Matrix:
    return Matrix.Translation(origin) @ rotation.to_3x3().to_4x4()


def _knee(hip: Vector, ankle: Vector, thigh: float, shin: float) -> tuple[Vector, Vector]:
    """Where the knee is for a foot at `ankle`, bending forwards. Also the ankle, pulled in if out of reach."""
    to_ankle = ankle - hip
    reach = min(max(to_ankle.length, abs(thigh - shin) + 1e-3), thigh + shin - 1e-3)
    along = to_ankle.normalized()
    ankle = hip + along * reach
    forward = Vector((0.0, -1.0, 0.0))
    sideways = forward - along * forward.dot(along)
    sideways = sideways.normalized() if sideways.length > 1e-6 else Vector((1.0, 0.0, 0.0))
    near = (thigh * thigh - shin * shin + reach * reach) / (2 * reach)
    out = math.sqrt(max(thigh * thigh - near * near, 0.0))
    return hip + along * near + sideways * out, ankle


def solve(proportions: dict, pose: dict | None, rest: "Skeleton | None" = None) -> Skeleton:
    """
    Places every joint and bone for a pose. `rest` is the same figure in its
    rest pose; limbs keep the twist they have there, so that a knee cap or a
    shoulder plate stays on the right side of the limb as it swings.
    """
    p = proportions
    q = full_pose(pose)
    result = Skeleton()
    joints, bones = result.joints, result.bones
    lean = p.get("chest_forward", 0.0)

    hips_turn = turn(q["hips_turn"])
    chest_turn = turn(q["chest_turn"])
    result.head_turn = chest_turn @ turn(q["head_turn"])

    joints["root"] = Vector((0.0, 0.0, 0.0))
    joints["hips"] = Vector((0.0, 0.0, p["hip_height"])) + Vector(q["hips_offset"])
    spine = chest_turn.to_3x3()
    joints["chest"] = joints["hips"] + spine @ Vector((0.0, -lean, p["torso_length"] * 0.62))
    joints["neck"] = joints["hips"] + spine @ Vector((0.0, -lean, p["torso_length"]))
    joints["head"] = joints["neck"] + spine @ Vector((0.0, -p["head_forward"], p["head_radii"][2] * 0.72))

    bones["root"] = Matrix.Identity(4)
    bones["hips"] = _place(joints["hips"], hips_turn)
    bones["chest"] = _place(joints["hips"], chest_turn)
    bones["head"] = _place(joints["head"], result.head_turn)
    cape_root = joints["neck"] + spine @ Vector((0.0, p["chest_radii"][1], 0.0))
    bones["cape"] = _place(cape_root, chest_turn @ Matrix.Rotation(math.radians(-q["cape_swing"]), 4, "X"))

    def limb(name: str, origin: Vector, direction: Vector) -> None:
        """A bone that points along `direction`, twisted as little as possible from its rest pose."""
        if rest is None:
            bones[name] = _place(origin, frame(direction))
            return
        at_rest = rest.bones[name].to_3x3()
        rest_direction = at_rest @ Vector((0.0, 0.0, 1.0))
        swing = rest_direction.rotation_difference(direction.normalized()).to_matrix()
        bones[name] = _place(origin, (swing @ at_rest).to_4x4())

    for side, sign in (("l", 1.0), ("r", -1.0)):
        shoulder = joints["hips"] + spine @ Vector(
            (sign * p["shoulder_half_width"], -lean, p["torso_length"] - p["shoulder_drop"])
        )
        upper = Vector(q[f"upper_arm_{side}"]).normalized()
        fore = Vector(q[f"forearm_{side}"]).normalized()
        elbow = shoulder + upper * p["upper_arm"]
        hand = elbow + fore * p["forearm"]
        joints[f"shoulder_{side}"], joints[f"elbow_{side}"], joints[f"hand_{side}"] = shoulder, elbow, hand
        limb(f"upper_arm_{side}", shoulder, upper)
        limb(f"forearm_{side}", elbow, fore)
        bones[f"hand_{side}"] = _place(hand, bones[f"forearm_{side}"])

        hip = joints["hips"] + hips_turn.to_3x3() @ Vector((sign * p["hip_half_width"], 0.0, 0.0))
        target = q[f"foot_{side}"]
        if target is not None:
            knee, foot = _knee(hip, Vector(target), p["thigh"], p["shin"])
        else:
            knee = hip + Vector(q[f"thigh_{side}"]).normalized() * p["thigh"]
            foot = knee + Vector(q[f"shin_{side}"]).normalized() * p["shin"]
        joints[f"hip_{side}"], joints[f"knee_{side}"], joints[f"foot_{side}"] = hip, knee, foot
        limb(f"thigh_{side}", hip, knee - hip)
        limb(f"shin_{side}", knee, foot - knee)
        bones[f"foot_{side}"] = _place(
            foot, Matrix.Rotation(math.radians(q[f"foot_pitch_{side}"]), 4, "X")
        )

    # The shield sets the twist of its forearm, and the weapon the turn of its hand.
    fore_l = Vector(q["forearm_l"]).normalized()
    bones["forearm_l"] = _place(joints["elbow_l"], frame(fore_l, q["shield_normal"]))
    bones["hand_l"] = _place(joints["hand_l"], bones["forearm_l"])
    bones["hand_r"] = _place(joints["hand_r"], frame(q["weapon_dir"], q["weapon_flat"]))
    return result


class Rig:
    """A Blender armature for one figure, with the figure's parts bound to its bones."""

    def __init__(self, name: str, rest: Skeleton, parts: list, bone_of: dict[str, str]) -> None:
        self.rest = rest
        data = bpy.data.armatures.new(f"{name}.skeleton")
        self.object = bpy.data.objects.new(f"{name}.skeleton", data)
        bpy.context.scene.collection.objects.link(self.object)

        # Bones can only be made in edit mode.
        bpy.context.view_layer.objects.active = self.object
        bpy.ops.object.mode_set(mode="EDIT")
        made = {}
        for bone, parent in BONES:
            edit = data.edit_bones.new(bone)
            edit.head = (0.0, 0.0, 0.0)
            edit.tail = (0.0, 0.2, 0.0)
            edit.matrix = rest.bones[bone]
            edit.length = 0.2
            if parent:
                edit.parent = made[parent]
                edit.use_connect = False
            made[bone] = edit
        bpy.ops.object.mode_set(mode="OBJECT")

        self._rest_inverse = {bone: rest.bones[bone].inverted() for bone, _ in BONES}
        for pose_bone in self.object.pose.bones:
            pose_bone.rotation_mode = "QUATERNION"

        # A part follows its bone rigidly: it keeps the place it has at rest.
        for part in parts:
            bone = bone_of[part.name]
            part.parent = self.object
            part.parent_type = "BONE"
            part.parent_bone = bone
            at_tail = rest.bones[bone] @ Matrix.Translation((0.0, 0.2, 0.0))
            part.matrix_parent_inverse = at_tail.inverted()

    def set_pose(self, skeleton: Skeleton) -> None:
        """Moves the bones to a solved pose."""
        parents = dict(BONES)
        for bone, _ in BONES:
            parent = parents[bone]
            if parent:
                frame_of_parent = skeleton.bones[parent] @ self._rest_inverse[parent] @ self.rest.bones[bone]
            else:
                frame_of_parent = self.rest.bones[bone]
            basis = frame_of_parent.inverted() @ skeleton.bones[bone]
            pose_bone = self.object.pose.bones[bone]
            pose_bone.location = basis.to_translation()
            pose_bone.rotation_quaternion = basis.to_quaternion()

    def bake(self, name: str, poses: list[Skeleton]) -> bpy.types.Action:
        """Stores an animation in Blender as one keyframe per bone and frame."""
        action = bpy.data.actions.new(name)
        if self.object.animation_data is None:
            self.object.animation_data_create()
        self.object.animation_data.action = action
        for index, skeleton in enumerate(poses):
            self.set_pose(skeleton)
            for pose_bone in self.object.pose.bones:
                pose_bone.keyframe_insert("location", frame=index)
                pose_bone.keyframe_insert("rotation_quaternion", frame=index)
        return action

    def stand(self) -> None:
        """Back to the rest pose, with no animation playing."""
        if self.object.animation_data is not None:
            self.object.animation_data.action = None
        self.set_pose(self.rest)

    def play(self, action: bpy.types.Action, frame_index: int) -> None:
        """Shows one frame of a baked animation."""
        self.object.animation_data.action = action
        bpy.context.scene.frame_set(frame_index)

    def face(self, yaw_deg: float) -> None:
        """Turns the whole figure around its vertical axis."""
        self.object.rotation_euler = (0.0, 0.0, math.radians(yaw_deg))
