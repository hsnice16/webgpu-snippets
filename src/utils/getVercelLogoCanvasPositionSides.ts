import { faceNormal } from "./faceNormal";

export function getVercelLogoCanvasPositionSides() {
  // 4 side faces (pyramid). We duplicate verts per face so each face can have flat normal.
  // Face vertices
  const P0 = [0.0, 0.75, 0.0]; // top
  const P1 = [0.5, -0.75, 0.5]; // front-right
  const P2 = [-0.5, -0.75, 0.5]; // front-left
  const P3 = [0.5, -0.75, -0.5]; // back-right
  const P4 = [-0.5, -0.75, -0.5]; // back-left

  // Triangles (per face):
  // F_front:  (P0, P1, P2)
  // F_right:  (P0, P3, P1)
  // F_left:   (P0, P2, P4)
  // F_back:   (P0, P4, P3)

  const F_front = [P0, P1, P2];
  const F_right = [P0, P3, P1];
  const F_left = [P0, P2, P4];
  const F_back = [P0, P4, P3];

  const N_front = faceNormal(
    ...(F_front as unknown as [number[], number[], number[]])
  );
  const N_right = faceNormal(
    ...(F_right as unknown as [number[], number[], number[]])
  );
  const N_left = faceNormal(
    ...(F_left as unknown as [number[], number[], number[]])
  );
  const N_back = faceNormal(
    ...(F_back as unknown as [number[], number[], number[]])
  );

  return {
    F_left,
    F_back,
    F_front,
    F_right,
    //
    N_left,
    N_back,
    N_front,
    N_right,
  };
}
