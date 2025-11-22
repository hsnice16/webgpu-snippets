import { mat4, vec3, vec4 } from "gl-matrix";

export class Arcball {
  private upVector: vec4;
  private forwardVector: vec4;
  private currentRotation: mat4;

  constructor() {
    this.currentRotation = mat4.create();
    this.upVector = vec4.fromValues(0.0, 1.0, 0.0, 0.0);
    this.forwardVector = vec4.fromValues(1.0, -1.0, 1.0, 0.0);
  }

  yawPitch(prevX: number, prevY: number, currX: number, currY: number) {
    const prevPoint = vec3.fromValues(1.0, prevX, prevY);
    const currPoint = vec3.fromValues(1.0, currX, currY);

    let rotationAxis = vec3.cross(vec3.create(), prevPoint, currPoint);
    rotationAxis = vec4.fromValues(
      rotationAxis[0],
      rotationAxis[1],
      rotationAxis[2],
      0.0
    );
    rotationAxis = vec4.transformMat4(
      mat4.create(),
      rotationAxis,
      this.currentRotation
    );
    rotationAxis = vec3.normalize(
      vec3.create(),
      vec3.fromValues(rotationAxis[0], rotationAxis[1], rotationAxis[2])
    );

    const sin =
      vec3.length(rotationAxis) /
      (vec3.length(prevPoint) * vec3.length(currPoint));

    const rotationMatrix = mat4.fromRotation(
      mat4.create(),
      Math.asin(sin) * -0.03,
      rotationAxis
    );

    if (rotationMatrix !== null) {
      this.currentRotation = mat4.multiply(
        mat4.create(),
        rotationMatrix,
        this.currentRotation
      );

      this.forwardVector = vec4.transformMat4(
        vec4.create(),
        this.forwardVector,
        rotationMatrix
      );

      this.upVector = vec4.transformMat4(
        vec4.create(),
        this.upVector,
        rotationMatrix
      );
    }
  }

  roll(prevX: number, prevY: number, currX: number, currY: number) {
    const prevVec = vec3.fromValues(prevX, prevY, 0.0);
    const currVec = vec3.fromValues(currX, currY, 0.0);

    const crossProd = vec3.cross(vec3.create(), prevVec, currVec);

    let rad = vec3.dot(
      vec3.normalize(vec3.create(), prevVec),
      vec3.normalize(vec3.create(), currVec)
    );

    if (rad > 1.0) {
      // cross product can be larger than 1.0 due to numerical error
      rad = Math.PI * Math.sign(crossProd[2]);
    } else {
      rad = Math.acos(rad) * Math.sign(crossProd[2]);
    }

    const rotationMatrix = mat4.fromRotation(
      mat4.create(),
      -rad,
      this.forwardVector
    );

    if (rotationMatrix !== null) {
      this.currentRotation = mat4.multiply(
        mat4.create(),
        rotationMatrix,
        this.currentRotation
      );

      this.upVector = vec4.transformMat4(
        vec4.create(),
        this.upVector,
        rotationMatrix
      );
    }
  }

  getMatrices() {
    const modelViewMatrix = mat4.lookAt(
      mat4.create(),
      vec3.fromValues(
        this.forwardVector[0],
        this.forwardVector[1],
        this.forwardVector[2]
      ),
      vec3.fromValues(0, 0, 0),
      vec3.fromValues(this.upVector[0], this.upVector[1], this.upVector[2])
    );

    return modelViewMatrix;
  }
}
