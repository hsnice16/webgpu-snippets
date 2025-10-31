"use client";

import { mat4, vec3 } from "gl-matrix";
import { useEffect, useRef, useState } from "react";

import { checkWebGPUSupport } from "@/utils";
import {
  createIndexBuffer,
  createVertexBuffer,
  createUniformBuffer,
  createVertexBufferLayoutDesc,
} from "@/utils/misc";

import code from "./shaders/vercel-logo-shaders.wgsl";

const SAMPLE_COUNT = 4;

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
          alphaMode: "opaque",
          format: canvasFormat,
        });

        ////////////////*********** Buffers ***********////////////////

        const positions = new Float32Array([
          // 0: top
          0.0, 0.75, 0.0,

          // 1: front-right (front + right)
          0.5, -0.75, 0.5,

          // 2: front-left (front + left)
          -0.5, -0.75, 0.5,

          // 3: back-right (right + back)
          0.5, -0.75, -0.5,

          // 4: back-left (left + back)
          -0.5, -0.75, -0.5,
        ]);

        const positionBuffer = createVertexBuffer(
          device,
          positions.byteLength,
          "Position Buffer Descriptor"
        );

        device.queue.writeBuffer(positionBuffer, 0, positions);

        const positionBufferLayoutDesc = createVertexBufferLayoutDesc({
          attribDescLabel: "Position Attribute Descriptor",
          bufferLayoutDescLabel: "Position Buffer Layout Descriptor",
        });

        const indices = new Uint16Array([0, 1, 2, 0, 3, 1, 0, 2, 4, 0, 4, 3]);

        const indexBuffer = createIndexBuffer(
          device,
          indices.byteLength,
          "Index Buffer"
        );

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

        const normalBuffer = createVertexBuffer(
          device,
          normals.byteLength,
          "Normal Buffer Descriptor"
        );

        device.queue.writeBuffer(normalBuffer, 0, normals);

        const normalBufferLayoutDesc = createVertexBufferLayoutDesc({
          shaderLocation: 1,
          attribDescLabel: "Normal Attribute Descriptor",
          bufferLayoutDescLabel: "Normal Buffer Layout Descriptor",
        });

        ////////////////*********** Uniform Buffers ***********////////////////

        const lightDirection = new Float32Array([-1.0, -1.0, -1.0]);

        const lightDirectionBuffer = createUniformBuffer(
          device,
          lightDirection.byteLength,
          "Light Direction Buffer Descriptor"
        );

        device.queue.writeBuffer(lightDirectionBuffer, 0, lightDirection);

        const viewDirection = new Float32Array([-1.0, -1.0, -1.0]);

        const viewDirectionBuffer = createUniformBuffer(
          device,
          viewDirection.byteLength,
          "View Direction Buffer Descriptor"
        );

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

        const normalMatrixBuffer = createUniformBuffer(
          device,
          normalMatrix.length * 4, // 16 floats * 4 bytes,
          "Normal Matirx Buffer Descriptor"
        );

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

        const modelViewProjectionMatrixBuffer = createUniformBuffer(
          device,
          modelViewProjectionMatrix.length * 4, // 16 floats * 4 bytes
          "Model View Projection Matrix Buffer Descriptor"
        );

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
            count: SAMPLE_COUNT,
          },
        });

        ////////////////*********** Multi-Sample Anti-Aliasing (MSAA) ***********////////////////

        const msaaTexture = device.createTexture({
          format: canvasFormat,
          sampleCount: SAMPLE_COUNT,
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
          label: "Multi-Sample Anti-Aliasing Texture",
          size: [canvasRef.current.width, canvasRef.current.height],
        });

        ////////////////*********** Depth Texture ***********////////////////

        const depthTexture = device.createTexture({
          dimension: "2d",
          label: "Depth Texture",
          sampleCount: SAMPLE_COUNT,
          format: "depth24plus-stencil8",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
          size: [canvasRef.current.width, canvasRef.current.height, 1],
        });

        ////////////////*********** Encoders ***********////////////////

        const commandEncoder = device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              loadOp: "clear",
              storeOp: "store",
              view: msaaTexture.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              resolveTarget: context.getCurrentTexture().createView(),
            },
          ],
          depthStencilAttachment: {
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            stencilClearValue: 0,
            stencilLoadOp: "clear",
            stencilStoreOp: "store",
            view: depthTexture.createView(),
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
    <section className="flex items-center justify-center bg-black min-h-screen w-full">
      <div className="text-white flex-1 flex flex-col gap-4 items-center justify-start text-left h-[250]">
        <h2 className="text-5xl font-geist-mono w-[500]">Vercel</h2>
        <p className="text-2xl font-geist-sans w-[500]">
          Build and deploy on the AI Cloud.
        </p>
      </div>
      <div className="text-white flex-1 flex items-center justify-center">
        {message ? (
          <h4 className="font-geist-sans">{message}</h4>
        ) : (
          <canvas ref={canvasRef} width={550} height={550} />
        )}
      </div>
    </section>
  );
}
