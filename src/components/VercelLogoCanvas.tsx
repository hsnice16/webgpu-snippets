"use client";

import { mat4, vec3 } from "gl-matrix";
import { useEffect, useRef, useState } from "react";

import { checkWebGPUSupport } from "@/utils";
import code from "./shaders/vercel-logo-shaders.wgsl";

export function VercelLogoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async function () {
      const isWebGPUSupported = checkWebGPUSupport();
      if (!isWebGPUSupported) {
        setMessage("Browser does not support WebGPU!!");
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        setMessage("Failed to get any GPUAdapter!!");
        return;
      }

      const device = await adapter.requestDevice();

      if (canvasRef.current) {
        const context = canvasRef.current.getContext("webgpu");
        if (!context) {
          setMessage("Failed to get the canvas `wegbgpu` context!!");
          return;
        }

        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

        ////////////////*********** Context Configure ***********////////////////

        context.configure({
          device,
          format: canvasFormat,
        });

        ////////////////*********** Buffers ***********////////////////

        const positions = new Float32Array([
          // 0: top
          0.0, 0.75, 0.0,

          // 1: front-right (front + right)
          0.75, -0.75, 0.75,

          // 2: front-left (front + left)
          -0.75, -0.75, 0.75,

          // 3: back-right (right + back)
          0.75, -0.75, -0.75,

          // 4: back-left (left + back)
          -0.75, -0.75, -0.75,
        ]);

        const positionBuffer = device.createBuffer({
          label: "Position Buffer Descriptor",
          size: positions.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(positionBuffer, 0, positions);

        const positionAttribDesc = {
          label: "Position Attribute Descriptor",
          shaderLocation: 0, // @location(0)
          offset: 0,
          format: "float32x3" as GPUVertexFormat,
        };

        const positionBufferLayoutDesc = {
          label: "Position Buffer Layout Descriptor",
          attributes: [positionAttribDesc],
          arrayStride: 4 * 3, // sizeof(float) * 3
          stepMode: "vertex" as GPUVertexStepMode,
        };

        const indices = new Uint16Array([0, 1, 2, 0, 3, 1, 0, 2, 4, 0, 4, 3]);

        const indexBuffer = device.createBuffer({
          label: "Index Buffer",
          size: indices.byteLength,
          usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(indexBuffer, 0, indices);

        const normals = new Float32Array([
          // 0: top (average of 4 faces)
          0.0, -1.0, 0.0,

          // 1: front-right (front + right, normalized)
          -0.5773503, -0.5773503, -0.5773503,

          // 2: front-left (front + left)
          0.5773503, -0.5773503, -0.5773503,

          // 3: back-right (right + back)
          -0.5773503, -0.5773503, 0.5773503,

          // 4: back-left (left + back)
          0.5773503, -0.5773503, 0.5773503,
        ]);

        const normalBuffer = device.createBuffer({
          label: "Normal Buffer Descriptor",
          size: normals.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(normalBuffer, 0, normals);

        const normalAttribDesc = {
          label: "Normal Attribute Descriptor",
          shaderLocation: 1, // @location(1)
          offset: 0,
          format: "float32x3" as GPUVertexFormat,
        };

        const normalBufferLayoutDesc = {
          label: "Normal Buffer Layout Descriptor",
          attributes: [normalAttribDesc],
          arrayStride: 4 * 3, // sizeof(float) * 3
          stepMode: "vertex" as GPUVertexStepMode,
        };

        ////////////////*********** Uniform Buffers ***********////////////////

        const lightDirection = new Float32Array([-1.0, -1.0, -1.0]);

        const lightDirectionBuffer = device.createBuffer({
          label: "Light Direction Buffer Descriptor",
          size: lightDirection.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(lightDirectionBuffer, 0, lightDirection);

        const viewDirection = new Float32Array([-1.0, -1.0, -1.0]);

        const viewDirectionBuffer = device.createBuffer({
          label: "View Direction Buffer Descriptor",
          size: viewDirection.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        ////////////////*********** Model View Matrix ***********////////////////

        const modelViewMatrix = mat4.lookAt(
          mat4.create(),
          vec3.fromValues(1, -1, 1),
          vec3.fromValues(0, 0, 0),
          vec3.fromValues(0.0, 1.0, 0.0)
        );

        ////////////////*********** Normal Matrix ***********////////////////

        const modelViewMatrixInverse = mat4.invert(
          mat4.create(),
          modelViewMatrix
        );

        const normalMatrix = mat4.transpose(
          mat4.create(),
          modelViewMatrixInverse!
        );

        const normalMatrixBuffer = device.createBuffer({
          label: "Normal Matirx Buffer Descriptor",
          size: normalMatrix.length * 4, // 16 floats * 4 bytes
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(
          normalMatrixBuffer,
          0,
          new Float32Array(normalMatrix)
        );

        ////////////////*********** Projection Matrix ***********////////////////

        const projectionMatrix = mat4.perspective(
          mat4.create(),
          1.4,
          canvasRef.current.width / canvasRef.current.height,
          0.1,
          1000.0
        );

        const modelViewProjectionMatrix = mat4.multiply(
          mat4.create(),
          projectionMatrix,
          modelViewMatrix
        );

        const modelViewProjectionMatrixBuffer = device.createBuffer({
          label: "Model View Projection Matrix Buffer Descriptor",
          size: modelViewProjectionMatrix.length * 4, // 16 floats * 4 bytes
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(
          modelViewProjectionMatrixBuffer,
          0,
          new Float32Array(modelViewProjectionMatrix)
        );

        ////////////////*********** Bind Group Layout ***********////////////////

        const bindGroupLayout = device.createBindGroupLayout({
          label: "Bind Group Layout Descriptor",
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
            {
              binding: 1,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
            {
              binding: 2,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
            {
              binding: 3,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
          ],
        });

        ////////////////*********** Bind Group ***********////////////////

        const bindGroup = device.createBindGroup({
          label: "Bind Group Descriptor",
          layout: bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: { buffer: modelViewProjectionMatrixBuffer },
            },
            {
              binding: 1,
              resource: { buffer: normalMatrixBuffer },
            },
            {
              binding: 2,
              resource: { buffer: lightDirectionBuffer },
            },
            {
              binding: 3,
              resource: { buffer: viewDirectionBuffer },
            },
          ],
        });

        ////////////////*********** Pipeline Layout ***********////////////////

        const pipelineLayout = device.createPipelineLayout({
          label: "Pipeline Layout Descriptor",
          bindGroupLayouts: [bindGroupLayout],
        });

        ////////////////*********** Pipeline ***********////////////////

        const pipeline = device.createRenderPipeline({
          label: "Render Pipeline Descriptor",
          layout: pipelineLayout,
          vertex: {
            module: device.createShaderModule({ code }),
            entryPoint: "vs_main",
            buffers: [positionBufferLayoutDesc, normalBufferLayoutDesc],
          },
          fragment: {
            module: device.createShaderModule({ code }),
            entryPoint: "fs_main",
            targets: [
              {
                format: canvasFormat,
              },
            ],
          },
          primitive: {
            cullMode: "back",
          },
          depthStencil: {
            depthCompare: "less",
            depthWriteEnabled: true,
            format: "depth24plus-stencil8",
          },
          multisample: {
            count: 4,
          },
        });

        ////////////////*********** Multi-Sample Anti-Aliasing (MSAA) ***********////////////////

        const msaaTexture = device.createTexture({
          sampleCount: 4,
          format: canvasFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
          label: "Multi-Sample Anti-Aliasing Texture",
          size: [canvasRef.current.width, canvasRef.current.height],
        });

        ////////////////*********** Depth Texture ***********////////////////

        const depthTexture = device.createTexture({
          sampleCount: 4,
          dimension: "2d",
          label: "Depth Texture",
          format: "depth24plus-stencil8",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
          size: [canvasRef.current.width, canvasRef.current.height, 1],
        });

        ////////////////*********** Encoders ***********////////////////

        const commandEncoder = device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: msaaTexture.createView(),
              resolveTarget: context.getCurrentTexture().createView(),
              loadOp: "clear",
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: "store",
            },
          ],
          depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            stencilClearValue: 0,
            stencilLoadOp: "clear",
            stencilStoreOp: "store",
          },
        });

        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, positionBuffer);
        renderPass.setVertexBuffer(1, normalBuffer);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setIndexBuffer(indexBuffer, "uint16");
        renderPass.drawIndexed(indices.length);

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
      }
    })();
  }, []);

  return (
    <section>
      {message ? (
        <h4>{message}</h4>
      ) : (
        <canvas ref={canvasRef} className="min-h-screen w-full" />
      )}
    </section>
  );
}
