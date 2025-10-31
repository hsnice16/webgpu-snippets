"use client";

import { mat4, vec3 } from "gl-matrix";
import { useEffect, useRef, useState } from "react";

import { useIsMobile } from "@/hooks";
import { checkWebGPUSupport } from "@/utils";
import {
  faceNormal,
  createVertexBuffer,
  createUniformBuffer,
  createVertexBufferLayoutDesc,
} from "@/utils/misc";

import code from "./shaders/vercel-logo-shaders.wgsl";

const SAMPLE_COUNT = 4;

export function VercelLogoCanvas() {
  const isMobile = useIsMobile();
  const [message, setMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
          setMessage("Failed to get the canvas `webgpu` context!!");
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

        // Pre-vertex positions (duplicated per face)
        const positions = new Float32Array([
          // front face
          ...F_front[0],
          ...F_front[1],
          ...F_front[2],

          // right face
          ...F_right[0],
          ...F_right[1],
          ...F_right[2],

          // left face
          ...F_left[0],
          ...F_left[1],
          ...F_left[2],

          // back face
          ...F_back[0],
          ...F_back[1],
          ...F_back[2],
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

        // Flat normals per face (same normal repeated 3 times)
        const normals = new Float32Array([
          ...N_front,
          ...N_front,
          ...N_front,
          //
          ...N_right,
          ...N_right,
          ...N_right,
          //
          ...N_left,
          ...N_left,
          ...N_left,
          //
          ...N_back,
          ...N_back,
          ...N_back,
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

        const lightDirection = new Float32Array([0.25, 0.25, -4.0]);

        const lightDirectionBuffer = createUniformBuffer(
          device,
          lightDirection.byteLength,
          "Light Direction Buffer Descriptor"
        );

        device.queue.writeBuffer(lightDirectionBuffer, 0, lightDirection);

        const viewDirection = new Float32Array([0.25, 0.25, -4.0]);

        const viewDirectionBuffer = createUniformBuffer(
          device,
          viewDirection.byteLength,
          "View Direction Buffer Descriptor"
        );

        device.queue.writeBuffer(viewDirectionBuffer, 0, viewDirection);

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

        const vertexCount = 4 /*faces*/ * 3; /*verts per face*/ // = 12
        renderPass.draw(vertexCount);

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
      }
    })();
  }, []);

  return (
    <section className="flex items-center justify-center flex-col sm:flex-row bg-black min-h-screen w-full">
      <div className="text-white sm:flex-1 flex flex-col items-center justify-center gap-4">
        <div className="max-w-[500] m-auto sm:h-[250]">
          <h2 className="text-xl sm:text-5xl font-geist-mono">Vercel</h2>

          <p className="text-lg sm:text-2xl font-geist-sans">
            Build and deploy on the AI Cloud.
          </p>
        </div>
      </div>

      <div className="text-white sm:flex-1 flex items-center justify-center">
        {message ? (
          <h4 className="font-geist-sans">{message}</h4>
        ) : (
          <canvas
            ref={canvasRef}
            width={isMobile ? 250 : 550}
            height={isMobile ? 250 : 550}
          />
        )}
      </div>
    </section>
  );
}
