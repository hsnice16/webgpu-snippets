import { TCreateVertexBufferLayoutDesc } from "@/types";

export function getAdapter() {
  return navigator.gpu.requestAdapter();
}

export function getDevice(adapter: GPUAdapter) {
  return adapter.requestDevice();
}

export function configureContext(
  device: GPUDevice,
  canvas: HTMLCanvasElement,
  format: GPUTextureFormat
) {
  const context = canvas.getContext("webgpu");
  if (context) {
    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
  }

  return context;
}

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
