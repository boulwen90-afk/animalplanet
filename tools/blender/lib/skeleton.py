"""
The joints shared by every race. All races use the same joint names, so that
animations can be shared once the figures get a skeleton. Only the positions
differ, and they follow from the race's proportions.

The figure stands on z = 0 and faces -Y. Its left side is +X ("_l"), its right
side is -X ("_r").
"""

from mathutils import Matrix, Vector

JOINTS = (
    "root",
    "hips",
    "chest",
    "neck",
    "head",
    "shoulder_l",
    "elbow_l",
    "hand_l",
    "shoulder_r",
    "elbow_r",
    "hand_r",
    "hip_l",
    "knee_l",
    "foot_l",
    "hip_r",
    "knee_r",
    "foot_r",
)

# Limb directions when a unit config says nothing: arms and legs hang straight down.
DEFAULT_POSE = {
    "upper_arm_l": (0.15, 0.0, -1.0),
    "forearm_l": (0.05, -0.1, -1.0),
    "upper_arm_r": (-0.15, 0.0, -1.0),
    "forearm_r": (-0.05, -0.1, -1.0),
    "thigh_l": (0.06, -0.04, -1.0),
    "shin_l": (0.02, 0.06, -1.0),
    "thigh_r": (-0.06, -0.04, -1.0),
    "shin_r": (-0.02, 0.06, -1.0),
}


def posed_joints(proportions: dict, pose: dict | None = None) -> dict[str, Vector]:
    """Where each joint is, for a race's proportions and a unit's static pose."""
    p = proportions
    directions = {**DEFAULT_POSE, **{k: v for k, v in (pose or {}).items() if k in DEFAULT_POSE}}
    lean = p.get("chest_forward", 0.0)

    joints: dict[str, Vector] = {"root": Vector((0.0, 0.0, 0.0))}
    joints["hips"] = Vector((0.0, 0.0, p["hip_height"]))
    joints["chest"] = Vector((0.0, -lean, p["hip_height"] + p["torso_length"] * 0.62))
    joints["neck"] = Vector((0.0, -lean, p["hip_height"] + p["torso_length"]))
    joints["head"] = joints["neck"] + Vector((0.0, -p["head_forward"], p["head_radii"][2] * 0.72))

    for side, sign in (("l", 1.0), ("r", -1.0)):
        shoulder = Vector(
            (sign * p["shoulder_half_width"], -lean, joints["neck"].z - p["shoulder_drop"])
        )
        elbow = shoulder + Vector(directions[f"upper_arm_{side}"]).normalized() * p["upper_arm"]
        hand = elbow + Vector(directions[f"forearm_{side}"]).normalized() * p["forearm"]
        hip = Vector((sign * p["hip_half_width"], 0.0, p["hip_height"]))
        knee = hip + Vector(directions[f"thigh_{side}"]).normalized() * p["thigh"]
        foot = knee + Vector(directions[f"shin_{side}"]).normalized() * p["shin"]
        joints[f"shoulder_{side}"] = shoulder
        joints[f"elbow_{side}"] = elbow
        joints[f"hand_{side}"] = hand
        joints[f"hip_{side}"] = hip
        joints[f"knee_{side}"] = knee
        joints[f"foot_{side}"] = foot

    assert set(joints) == set(JOINTS)
    return joints


def head_rotation(pose: dict | None) -> Matrix:
    """How the head is turned. A positive `head_pitch_deg` lowers the muzzle."""
    import math

    pitch = math.radians((pose or {}).get("head_pitch_deg", 0.0))
    return Matrix.Rotation(pitch, 4, "X")
