"""Low-poly primitives. Every part is its own flat-shaded object, built in place."""

import bmesh
import bpy
from mathutils import Matrix, Vector

Vec = tuple[float, float, float]


def frame(z_dir: Vec, x_hint: Vec = (1.0, 0.0, 0.0)) -> Matrix:
    """A rotation that turns +Z to `z_dir` and +X as close to `x_hint` as it can."""
    z = Vector(z_dir).normalized()
    x = Vector(x_hint) - z * Vector(x_hint).dot(z)
    if x.length < 1e-6:
        x = Vector((0.0, 1.0, 0.0)) - z * z.y
    x.normalize()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_4x4()


class Builder:
    """Creates the parts of one figure in a collection, parented to a common root."""

    def __init__(self, name: str) -> None:
        self.collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(self.collection)
        self.root = bpy.data.objects.new(f"{name}.root", None)
        self.collection.objects.link(self.root)
        self.parts: list[bpy.types.Object] = []

    def _finish(self, name: str, bm: bmesh.types.BMesh, material: bpy.types.Material):
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(material)
        obj = bpy.data.objects.new(name, mesh)
        obj.parent = self.root
        self.collection.objects.link(obj)
        self.parts.append(obj)
        return obj

    def ellipsoid(
        self,
        name: str,
        center: Vec,
        radii: Vec,
        material: bpy.types.Material,
        detail: int = 2,
        rotation: Matrix | None = None,
        keep_above: float | None = None,
    ):
        """A faceted ball. `keep_above` (-1..1) cuts away everything below that height, leaving a dome."""
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
        if keep_above is not None:
            geometry = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(
                bm,
                geom=geometry,
                plane_co=(0.0, 0.0, keep_above),
                plane_no=(0.0, 0.0, 1.0),
                clear_inner=True,
            )
            rim = [edge for edge in bm.edges if edge.is_boundary]
            if rim:
                bmesh.ops.holes_fill(bm, edges=rim)
        transform = Matrix.Translation(center) @ (rotation or Matrix.Identity(4))
        bm.transform(transform @ Matrix.Diagonal((*radii, 1.0)))
        return self._finish(name, bm, material)

    def limb(
        self,
        name: str,
        start: Vec,
        end: Vec,
        radius_start: float,
        radius_end: float,
        material: bpy.types.Material,
        segments: int = 8,
        flatten: float = 1.0,
        x_hint: Vec = (1.0, 0.0, 0.0),
    ):
        """A tapered cylinder from one point to another. `flatten` squeezes it along its local Y."""
        a, b = Vector(start), Vector(end)
        bm = bmesh.new()
        bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            cap_tris=False,
            segments=segments,
            radius1=radius_start,
            radius2=radius_end,
            depth=(b - a).length,
        )
        bm.transform(Matrix.Diagonal((1.0, flatten, 1.0, 1.0)))
        bm.transform(Matrix.Translation((a + b) / 2) @ frame(b - a, x_hint))
        return self._finish(name, bm, material)

    def box(
        self,
        name: str,
        center: Vec,
        size: Vec,
        material: bpy.types.Material,
        rotation: Matrix | None = None,
    ):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        transform = Matrix.Translation(center) @ (rotation or Matrix.Identity(4))
        bm.transform(transform @ Matrix.Diagonal((*size, 1.0)))
        return self._finish(name, bm, material)

    def sheet(
        self,
        name: str,
        rows: list[list[Vec]],
        material: bpy.types.Material,
    ):
        """A cloth-like surface through a grid of points (rows of equal length)."""
        bm = bmesh.new()
        grid = [[bm.verts.new(point) for point in row] for row in rows]
        for upper, lower in zip(grid, grid[1:]):
            for i in range(len(upper) - 1):
                bm.faces.new((upper[i], upper[i + 1], lower[i + 1], lower[i]))
        return self._finish(name, bm, material)
