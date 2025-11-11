"use client";

import { mat4, vec3 } from "gl-matrix";
import { useRef, useState, useEffect, MouseEventHandler } from "react";

import {
  MAX_OFFSET,
  RETURN_SPEED,
  SAMPLE_COUNT,
  RETURN_IDLE_MS,
  ROTATION_SPEED,
} from "@/constants";

import { useIsMobile } from "@/hooks";
import { checkWebGPUSupport, getVercelLogoCanvasPositionSides } from "@/utils";

import {
  getDevice,
  getAdapter,
  configureContext,
  createVertexBuffer,
  createUniformBuffer,
  createVertexBufferLayoutDesc,
} from "@/utils/webgpu";

import code from "./shaders/vercel-logo-shader.wgsl";
import { AnimatedDownArrow } from "./ui";

export function VercelLogoCanvas() {
  const isMobile = useIsMobile();
  const [message, setMessage] = useState("");

  const angleRef = useRef(0);
  const translateX = useRef(0);
  const translateY = useRef(0);
  const lastMouseMoveAtRef = useRef(0);

  const rafRef = useRef<number>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTimestampRef = useRef<number>(undefined);

  useEffect(() => {
    let drawCancelled = false;

    (async function () {
      const isWebGPUSupported = checkWebGPUSupport();
      if (!isWebGPUSupported) {
        setMessage("Browser does not support WebGPU!!");
        return;
      }

      const adapter = await getAdapter();
      if (!adapter) {
        setMessage("Failed to get any GPUAdapter!!");
        return;
      }

      const device = await getDevice(adapter);

      if (canvasRef.current) {
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        const context = configureContext(
          device,
          canvasRef.current,
          canvasFormat
        );

        if (!context) {
          setMessage("Failed to get the canvas `webgpu` context!!");
          return;
        }

        /**
         * Vertex Buffers
         */

        const {
          F_left,
          F_back,
          F_front,
          F_right,
          N_left,
          N_back,
          N_front,
          N_right,
        } = getVercelLogoCanvasPositionSides();

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

        /**
         * Uniform Buffers
         */

        const lightDirection = new Float32Array([0, 0, -1.0]);

        const lightDirectionBuffer = createUniformBuffer(
          device,
          lightDirection.byteLength,
          "Light Direction Buffer Descriptor"
        );

        device.queue.writeBuffer(lightDirectionBuffer, 0, lightDirection);

        const viewDirection = new Float32Array([0, 0, -1.0]);

        const viewDirectionBuffer = createUniformBuffer(
          device,
          viewDirection.byteLength,
          "View Direction Buffer Descriptor"
        );

        device.queue.writeBuffer(viewDirectionBuffer, 0, viewDirection);

        /**
         * Model View Matrix
         */

        const modelMatrix = mat4.create();

        const modelMatrixBuffer = createUniformBuffer(
          device,
          modelMatrix.length * 4, // 16 floats * 4 bytes
          "Model Matrix Buffer Descriptor"
        );

        device.queue.writeBuffer(
          modelMatrixBuffer,
          0,
          new Float32Array(modelMatrix)
        );

        const viewMatrix = mat4.lookAt(
          mat4.create(),
          vec3.fromValues(1, -1, 1),
          vec3.fromValues(0, 0, 0),
          vec3.fromValues(0.0, 1.0, 0.0)
        );

        const viewMatrixBuffer = createUniformBuffer(
          device,
          viewMatrix.length * 4, // 16 floats * 4 bytes
          "View Matrix Buffer Descriptor"
        );

        device.queue.writeBuffer(
          viewMatrixBuffer,
          0,
          new Float32Array(viewMatrix)
        );

        /**
         * Normal Matrix
         */

        const modelViewMatrix = mat4.multiply(
          mat4.create(),
          viewMatrix,
          modelMatrix
        );

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

        /**
         * Projection Matrix
         */

        const projectionMatrix = mat4.perspective(
          mat4.create(),
          1.4,
          canvasRef.current.width / canvasRef.current.height,
          0.1,
          1000.0
        );

        const projectionMatrixBuffer = createUniformBuffer(
          device,
          projectionMatrix.length * 4, // 16 floats * 4 bytes
          "Projection Matrix Buffer Descriptor"
        );

        /**
         * Bind Group Layout & Bind Group
         */

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
            {
              binding: 4,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
            {
              binding: 5,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
          ],
        });

        const bindGroup = device.createBindGroup({
          label: "Bind Group Descriptor",
          layout: bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: { buffer: modelMatrixBuffer },
            },
            {
              binding: 1,
              resource: { buffer: viewMatrixBuffer },
            },
            {
              binding: 2,
              resource: { buffer: projectionMatrixBuffer },
            },
            {
              binding: 3,
              resource: { buffer: normalMatrixBuffer },
            },
            {
              binding: 4,
              resource: { buffer: lightDirectionBuffer },
            },
            {
              binding: 5,
              resource: { buffer: viewDirectionBuffer },
            },
          ],
        });

        /**
         * Pipeline Layout & Pipeline
         */

        const pipelineLayout = device.createPipelineLayout({
          label: "Pipeline Layout Descriptor",
          bindGroupLayouts: [bindGroupLayout],
        });

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
            targets: [{ format: canvasFormat }],
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

        /**
         * Draw Function
         */

        const draw = (timestampInSec: number) => {
          if (drawCancelled) {
            return;
          }

          angleRef.current += ROTATION_SPEED * timestampInSec;

          // Update model and normal matrix
          const modelMatrix = mat4.create();
          mat4.translate(
            modelMatrix,
            modelMatrix,
            vec3.fromValues(translateX.current, translateY.current, 0)
          );
          mat4.rotateY(modelMatrix, modelMatrix, angleRef.current);

          const modelViewMatrix = mat4.multiply(
            mat4.create(),
            viewMatrix,
            modelMatrix
          );

          const modelViewMatrixInverse = mat4.invert(
            mat4.create(),
            modelViewMatrix
          );

          const normalMatrix = mat4.transpose(
            mat4.create(),
            modelViewMatrixInverse!
          );

          // Upload uniforms
          device.queue.writeBuffer(
            modelMatrixBuffer,
            0,
            new Float32Array(modelMatrix)
          );
          device.queue.writeBuffer(
            normalMatrixBuffer,
            0,
            new Float32Array(normalMatrix)
          );

          /**
           * Projection Matrix, Depth Texture & Multi-Sample Anti-Aliasing (MSAA)
           */

          const projectionMatrix = mat4.perspective(
            mat4.create(),
            1.4,
            canvasRef.current!.width / canvasRef.current!.height,
            0.1,
            1000.0
          );

          device.queue.writeBuffer(
            projectionMatrixBuffer,
            0,
            new Float32Array(projectionMatrix)
          );

          const depthTexture = device.createTexture({
            dimension: "2d",
            label: "Depth Texture",
            sampleCount: SAMPLE_COUNT,
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [canvasRef.current!.width, canvasRef.current!.height, 1],
          });

          const msaaTexture = device.createTexture({
            format: canvasFormat,
            sampleCount: SAMPLE_COUNT,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            label: "Multi-Sample Anti-Aliasing Texture",
            size: [canvasRef.current!.width, canvasRef.current!.height],
          });

          /**
           * Encoder
           */

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

          const vertexCount = 4 * 3; // faces * verts per face
          renderPass.draw(vertexCount);

          renderPass.end();
          device.queue.submit([commandEncoder.finish()]);
        };

        /**
         * Loop Function
         */

        const loop = (timestamp: number) => {
          // Timestamp in seconds
          const lastTimestamp = lastTimestampRef.current ?? timestamp;
          const timestampInSec = Math.min(
            (timestamp - lastTimestamp) / 1000,
            0.1
          );

          // Smooth return to center after inactivity
          const now = performance.now();
          if (now - (lastMouseMoveAtRef.current || 0) > RETURN_IDLE_MS) {
            const t = Math.min(1, RETURN_SPEED * timestampInSec);

            translateX.current += (0 - translateX.current) * t;
            translateY.current += (0 - translateY.current) * t;
          }

          lastTimestampRef.current = timestamp;

          draw(timestampInSec);
          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      }
    })();

    return () => {
      drawCancelled = true;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  /**
   * Handlers
   */

  const handleMouseMove: MouseEventHandler<HTMLCanvasElement> = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      translateX.current = 0;
      translateY.current = 0;
      return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const clientRect = canvas.getBoundingClientRect();

    const mouseX = event.clientX - clientRect.left;
    const mouseY = event.clientY - clientRect.top;

    // Normalize to [-1, 1]
    let localTranslateX = (mouseX - centerX) / centerX;
    let localTranslateY = (mouseY - centerY) / centerY;

    // Screen Y grows down; flip so up is positive
    localTranslateY = -localTranslateY;

    localTranslateX = Math.max(-1, Math.min(1, localTranslateX)) * MAX_OFFSET;
    localTranslateY = Math.max(-1, Math.min(1, localTranslateY)) * MAX_OFFSET;

    localTranslateY = Number(localTranslateY.toFixed(4));
    localTranslateX = Number(localTranslateX.toFixed(4));

    translateX.current = localTranslateX;
    translateY.current = localTranslateY;

    lastMouseMoveAtRef.current = performance.now();
  };

  const handleMouseLeave = () => {
    translateX.current = 0;
    translateY.current = 0;
  };

  /**
   * Return
   */

  return (
    <section className="bg-black min-h-dvh w-full relative">
      <div className="flex items-center justify-center flex-col sm:flex-row min-h-dvh sm:min-h-auto">
        <div className="sm:flex-1">
          <div className="text-white max-w-[500] m-auto sm:h-[340]">
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
              width={isMobile ? 420 : 840}
              height={isMobile ? 420 : 840}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onPointerMove={handleMouseMove}
              onPointerLeave={handleMouseLeave}
            />
          )}
        </div>
      </div>

      <AnimatedDownArrow />
    </section>
  );
}
