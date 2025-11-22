"use client";

import clsx from "clsx";
import { mat4 } from "gl-matrix";
import { useRef, useState, useEffect, PointerEventHandler } from "react";

import { ROLL, SAMPLE_COUNT, YAW_PITCH } from "@/constants";
import { useIsMobile } from "@/hooks";

import {
  Arcball,
  getCursorPosition,
  checkWebGPUSupport,
  getVercelLogoCanvasPositionSides,
} from "@/utils";

import {
  getDevice,
  getAdapter,
  configureContext,
  createVertexBuffer,
  createUniformBuffer,
  createVertexBufferLayoutDesc,
} from "@/utils/webgpu";

import code from "./shaders/vercel-logo-arc-ball-shader.wgsl";
import { SectionInfoPara } from "./ui";

export function VercelLogoArcBallCanvas() {
  const isMobile = useIsMobile();
  const [message, setMessage] = useState("");
  const [isPointerDown, setIsPointerDown] = useState(false);

  const prevXRef = useRef(0.0);
  const prevYRef = useRef(0.0);
  const isDraggingRef = useRef(0);
  const arcballRef = useRef<Arcball>(undefined);
  const drawRef = useRef<() => void>(undefined);

  const rafRef = useRef<number>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastCanvasWidthRef = useRef<number>(undefined);
  const lastCanvasHeightRef = useRef<number>(undefined);

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

        arcballRef.current = new Arcball();

        const modelViewMatrix = arcballRef.current.getMatrices();

        const modelViewMatrixBuffer = createUniformBuffer(
          device,
          modelViewMatrix.length * 4, // 16 floats * 4 bytes
          "View Matrix Buffer Descriptor"
        );

        device.queue.writeBuffer(
          modelViewMatrixBuffer,
          0,
          new Float32Array(modelViewMatrix)
        );

        /**
         * Normal Matrix
         */

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

        const projectionMatrixBuffer = createUniformBuffer(
          device,
          16 * 4, // 16 floats * 4 bytes
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
          ],
        });

        const bindGroup = device.createBindGroup({
          label: "Bind Group Descriptor",
          layout: bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: { buffer: modelViewMatrixBuffer },
            },
            {
              binding: 1,
              resource: { buffer: projectionMatrixBuffer },
            },
            {
              binding: 2,
              resource: { buffer: normalMatrixBuffer },
            },
            {
              binding: 3,
              resource: { buffer: lightDirectionBuffer },
            },
            {
              binding: 4,
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
         * Get Canvas Size Dependent Configs Function
         */

        const getCanvasSizeDependentConfigs = () => {
          /**
           * Projection Marix
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

          /**
           * Depth Texture & Multi-Sample Anti-Aliasing (MSAA)
           */

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

          return { depthTexture, msaaTexture };
        };

        /**
         * Draw Function
         */

        let { depthTexture, msaaTexture } = getCanvasSizeDependentConfigs();

        drawRef.current = () => {
          if (drawCancelled) {
            return;
          }

          if (
            lastCanvasHeightRef.current !== canvasRef.current?.height ||
            lastCanvasWidthRef.current !== canvasRef.current?.width
          ) {
            ({ depthTexture, msaaTexture } = getCanvasSizeDependentConfigs());

            lastCanvasWidthRef.current = canvasRef.current?.width;
            lastCanvasHeightRef.current = canvasRef.current?.height;
          }

          if (arcballRef.current) {
            // Update model-view and normal matrix
            const modelViewMatrix = arcballRef.current.getMatrices();

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
              modelViewMatrixBuffer,
              0,
              new Float32Array(modelViewMatrix)
            );
            device.queue.writeBuffer(
              normalMatrixBuffer,
              0,
              new Float32Array(normalMatrix)
            );
          }

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

        rafRef.current = requestAnimationFrame(drawRef.current);
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

  const handlePointerUp: PointerEventHandler<HTMLCanvasElement> = (event) => {
    if (event.isPrimary) {
      isDraggingRef.current = 0;
      setIsPointerDown(false);
    }
  };

  const handlePointerDown: PointerEventHandler<HTMLCanvasElement> = (event) => {
    if (event.isPrimary) {
      const canvas = canvasRef.current;
      setIsPointerDown(true);

      if (canvas) {
        const { posX, posY } = getCursorPosition(
          event.clientX,
          event.clientY,
          canvas
        );

        prevXRef.current = posX;
        prevYRef.current = posY;

        if (
          prevXRef.current * prevXRef.current +
            prevYRef.current * prevYRef.current <
          0.64
        ) {
          isDraggingRef.current = YAW_PITCH;
        } else {
          isDraggingRef.current = ROLL;
        }
      }
    }
  };

  const handlePointerMove: PointerEventHandler<HTMLCanvasElement> = (event) => {
    if (
      drawRef.current &&
      event.isPrimary &&
      arcballRef.current &&
      isDraggingRef.current !== 0
    ) {
      const canvas = canvasRef.current;

      if (canvas) {
        const { posX, posY } = getCursorPosition(
          event.clientX,
          event.clientY,
          canvas
        );

        if (isDraggingRef.current === YAW_PITCH) {
          arcballRef.current.yawPitch(
            prevXRef.current,
            prevYRef.current,
            posX,
            posY
          );
        } else if (isDraggingRef.current === ROLL) {
          arcballRef.current.roll(
            prevXRef.current,
            prevYRef.current,
            posX,
            posY
          );
        }

        prevXRef.current = posX;
        prevYRef.current = posY;
        rafRef.current = requestAnimationFrame(drawRef.current);
      }
    }
  };

  /**
   * Return
   */

  return (
    <section
      id="vercel-logo-arc-ball"
      className="bg-black min-h-dvh w-full relative"
    >
      <SectionInfoPara light text="Arcball Camera Control" />
      <SectionInfoPara
        light
        order={2}
        text="Grab & drag the figure to see it in action"
      />

      <div className="text-white flex">
        {message ? (
          <h4
            className={clsx(
              "font-geist-sans mx-auto flex items-center justify-center",
              {
                "w-[420px] h-[420px]": isMobile,
                "w-[840px] h-[840px]": !isMobile,
              }
            )}
          >
            {message}
          </h4>
        ) : (
          <canvas
            ref={canvasRef}
            width={isMobile ? 420 : 840}
            height={isMobile ? 420 : 840}
            onPointerUp={handlePointerUp}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            className={clsx("touch-none mx-auto mt-24 sm:mt-auto", {
              "cursor-grab": !isPointerDown,
              "cursor-grabbing": isPointerDown,
            })}
          />
        )}
      </div>
    </section>
  );
}
