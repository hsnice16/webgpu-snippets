import { TCreateVertexBufferLayoutDesc } from "@/types";

export function createIndexBuffer(
  device: GPUDevice,
  size: number,
  label?: string
) {
  return device.createBuffer({
    size,
    label,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
}

export function createUniformBuffer(
  device: GPUDevice,
  size: number,
  label?: string
) {
  return device.createBuffer({
    size,
    label,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

export function createVertexBuffer(
  device: GPUDevice,
  size: number,
  label?: string
) {
  return device.createBuffer({
    size,
    label,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
}

export function createVertexBufferLayoutDesc({
  offset,
  format,
  vertexCount,
  shaderLocation,
  attribDescLabel,
  bufferLayoutDescLabel,
}: TCreateVertexBufferLayoutDesc) {
  const vertexAttribDesc = {
    offset: offset ?? 0,
    label: attribDescLabel,
    format: format ?? ("float32x3" as GPUVertexFormat),
    shaderLocation: shaderLocation ?? 0, // @location(0)
  };

  const vertexBufferLayoutDesc = {
    label: bufferLayoutDescLabel,
    attributes: [vertexAttribDesc],
    stepMode: "vertex" as GPUVertexStepMode,
    arrayStride: 4 * (vertexCount ?? 3), // sizeof(float) * 3
  };

  return vertexBufferLayoutDesc;
}

// Helper to compute flat face normal from 3 points
export function faceNormal(a: number[], b: number[], c: number[]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

  const n = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];

  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}
