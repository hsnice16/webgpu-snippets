"use client";

import { MouseEventHandler, useEffect, useRef, useState } from "react";

import { DIFFUSION_SIMULATION_TEXTURE_SIZE } from "@/constants";
import { checkWebGPUSupport, resizeCanvasForWebGPU } from "@/utils";
import {
  getDevice,
  getAdapter,
  configureContext,
  createVertexBuffer,
  createUniformBuffer,
  createVertexBufferLayoutDesc,
} from "@/utils/webgpu";

import computeCode from "./shaders/gray-scott-diffusion-compute-shader.wgsl";
import renderCode from "./shaders/gray-scott-diffusion-render-shader.wgsl";

export function GrayScottReactionDiffusionCanvas() {
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const rafRef = useRef<number>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawPositionRef = useRef(new Float32Array(3));

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
        resizeCanvasForWebGPU(canvasRef.current);

        ////////////////*********** Context Configure ***********////////////////

        const context = configureContext(
          device,
          canvasRef.current,
          canvasFormat
        );

        if (!context) {
          setMessage("Failed to get the canvas `webgpu` context!!");
          return;
        }

        ////////////////*********** Buffers ***********////////////////

        const positions = new Float32Array([
          1.0, 1.0, 1.0, 0.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 0.0, 0.0, -1.0,
          -1.0, 0.0, 1.0,
        ]);

        const positionBuffer = createVertexBuffer(
          device,
          positions.byteLength,
          "Diffusion Position Buffer Descriptor"
        );

        device.queue.writeBuffer(positionBuffer, 0, positions);

        const positionBufferLayoutDesc = createVertexBufferLayoutDesc({
          vertexCount: 4,
          format: "float32x4",
          attribDescLabel: "Diffusion Position Attribute Descriptor",
          bufferLayoutDescLabel: "Diffusion Position Buffer Layout Descriptor",
        });

        ////////////////*********** Uniform Buffers ***********////////////////

        const drawPositionBuffer = createUniformBuffer(
          device,
          drawPositionRef.current.byteLength,
          "Diffusion Draw Position Buffer Descriptor"
        );

        ////////////////*********** Textures ***********////////////////

        const srcTexture = device.createTexture({
          label: "Diffusion Src Texture Descriptor",
          dimension: "2d",
          format: "rg32float",
          size: [
            DIFFUSION_SIMULATION_TEXTURE_SIZE,
            DIFFUSION_SIMULATION_TEXTURE_SIZE,
            1,
          ],
          usage:
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING,
        });

        const initSrcTextureValues = [];
        for (let y = 0; y < DIFFUSION_SIMULATION_TEXTURE_SIZE; y++) {
          for (let x = 0; x < DIFFUSION_SIMULATION_TEXTURE_SIZE; x++) {
            if (x === 512 && y === 512) {
              initSrcTextureValues.push(0.0, 1.0); // Inject a tiny drop of B
            } else {
              initSrcTextureValues.push(1.0, 0.0);
            }
          }
        }

        device.queue.writeTexture(
          { texture: srcTexture },
          new Float32Array(initSrcTextureValues),
          {
            offset: 0,
            rowsPerImage: DIFFUSION_SIMULATION_TEXTURE_SIZE,
            bytesPerRow: DIFFUSION_SIMULATION_TEXTURE_SIZE * 8,
          },
          {
            width: DIFFUSION_SIMULATION_TEXTURE_SIZE,
            height: DIFFUSION_SIMULATION_TEXTURE_SIZE,
          }
        );

        await device.queue.onSubmittedWorkDone();

        const dstTexture = device.createTexture({
          label: "Diffusion Dst Texture Descriptor",
          dimension: "2d",
          format: "rg32float",
          size: [
            DIFFUSION_SIMULATION_TEXTURE_SIZE,
            DIFFUSION_SIMULATION_TEXTURE_SIZE,
            1,
          ],
          usage:
            GPUTextureUsage.COPY_SRC |
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING,
        });

        ////////////////*********** Sampler ***********////////////////

        const sampler = device.createSampler({
          label: "Diffusion Sampler Descriptor",
          magFilter: "nearest",
          minFilter: "nearest",
          mipmapFilter: "nearest",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
          addressModeW: "clamp-to-edge",
        });

        ////////////////*********** Bind Group Layout ***********////////////////

        const bindGroupLayout = device.createBindGroupLayout({
          label: "Diffusion Bind Group Layout Descriptor",
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.FRAGMENT,
              texture: {
                sampleType: "unfilterable-float",
              },
            },
            {
              binding: 1,
              visibility: GPUShaderStage.FRAGMENT,
              sampler: {
                type: "non-filtering",
              },
            },
          ],
        });

        const computeBindGroupLayout = device.createBindGroupLayout({
          label: "Diffusion Compute Bind Group Layout Descriptor",
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.COMPUTE,
              storageTexture: { access: "read-only", format: "rg32float" },
            },
            {
              binding: 1,
              visibility: GPUShaderStage.COMPUTE,
              storageTexture: { access: "write-only", format: "rg32float" },
            },
            {
              binding: 2,
              visibility: GPUShaderStage.COMPUTE,
              buffer: {},
            },
          ],
        });

        ////////////////*********** Bind Group ***********////////////////

        const bindGroup0 = device.createBindGroup({
          label: "Diffusion Bind Group 0 Descriptor",
          layout: bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: dstTexture.createView(),
            },
            {
              binding: 1,
              resource: sampler,
            },
          ],
        });

        const bindGroup1 = device.createBindGroup({
          label: "Diffusion Bind Group 1 Descriptor",
          layout: bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: srcTexture.createView(),
            },
            {
              binding: 1,
              resource: sampler,
            },
          ],
        });

        const computeBindGroup0 = device.createBindGroup({
          label: "Diffusion Compute Bind Group 0 Descriptor",
          layout: computeBindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: srcTexture.createView(),
            },
            {
              binding: 1,
              resource: dstTexture.createView(),
            },
            {
              binding: 2,
              resource: { buffer: drawPositionBuffer },
            },
          ],
        });

        const computeBindGroup1 = device.createBindGroup({
          label: "Diffusion Compute Bind Group 1 Descriptor",
          layout: computeBindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: dstTexture.createView(),
            },
            {
              binding: 1,
              resource: srcTexture.createView(),
            },
            {
              binding: 2,
              resource: { buffer: drawPositionBuffer },
            },
          ],
        });

        ////////////////*********** Pipeline Layout ***********////////////////

        const pipelineLayout = device.createPipelineLayout({
          label: "Diffusion Pipeline Layout Descriptor",
          bindGroupLayouts: [bindGroupLayout],
        });

        const computePipelineLayout = device.createPipelineLayout({
          label: "Diffusion Compute Pipeline Layout Descriptor",
          bindGroupLayouts: [computeBindGroupLayout],
        });

        ////////////////*********** Pipeline ***********////////////////

        const pipeline = device.createRenderPipeline({
          label: "Diffusion Render Pipeline Descriptor",
          layout: pipelineLayout,
          vertex: {
            module: device.createShaderModule({ code: renderCode }),
            entryPoint: "vs_main",
            buffers: [positionBufferLayoutDesc],
          },
          fragment: {
            module: device.createShaderModule({ code: renderCode }),
            entryPoint: "fs_main",
            targets: [{ format: canvasFormat }],
          },
          primitive: {
            topology: "triangle-strip",
            frontFace: "cw",
            cullMode: "none",
          },
        });

        const computePipeline = device.createComputePipeline({
          label: "Diffusion Compute Pipeline Descriptor",
          layout: computePipelineLayout,
          compute: {
            module: device.createShaderModule({ code: computeCode }),
            entryPoint: "cs_main",
          },
        });

        ////////////////*********** Draw Function ***********////////////////

        let frame = 0;

        const draw = () => {
          if (drawCancelled) {
            return;
          }

          device.queue.writeBuffer(
            drawPositionBuffer,
            0,
            drawPositionRef.current
          );

          ////////////////*********** Encoders ***********////////////////

          const commandEncoder = device.createCommandEncoder();

          const computePass = commandEncoder.beginComputePass({});
          computePass.setPipeline(computePipeline);

          if (frame % 2 === 0) {
            computePass.setBindGroup(0, computeBindGroup0);
          } else {
            computePass.setBindGroup(0, computeBindGroup1);
          }

          computePass.dispatchWorkgroups(64, 64);
          computePass.end();

          const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
              {
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                view: context.getCurrentTexture().createView(),
              },
            ],
          });

          renderPass.setPipeline(pipeline);
          renderPass.setVertexBuffer(0, positionBuffer);

          if (frame % 2 === 0) {
            renderPass.setBindGroup(0, bindGroup0);
          } else {
            renderPass.setBindGroup(0, bindGroup1);
          }

          renderPass.draw(4);
          renderPass.end();

          device.queue.submit([commandEncoder.finish()]);
          frame += 1;

          rafRef.current = requestAnimationFrame(draw);
        };

        rafRef.current = requestAnimationFrame(draw);
      }
    })();

    return () => {
      drawCancelled = true;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleMouseMove: MouseEventHandler<HTMLCanvasElement> = (event) => {
    if (isDragging) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();

        // 1) Convert CSS pixels (from the DOM rect) to canvas device pixels
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const xCanvasPx = (event.clientX - rect.left) * scaleX;
        const yCanvasPx = (event.clientY - rect.top) * scaleY;

        // 2) Map canvas device pixels to simulation texels (stored texture size)
        const xTexel =
          xCanvasPx * (DIFFUSION_SIMULATION_TEXTURE_SIZE / canvas.width);

        const yTexel =
          yCanvasPx * (DIFFUSION_SIMULATION_TEXTURE_SIZE / canvas.height);

        drawPositionRef.current.set([xTexel, yTexel, 1.0], 0);
      }
    }
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    drawPositionRef.current.set([0.0, 0.0, 0.0], 0);
  };

  return (
    <section
      id="gray-scott-diffusion"
      className="bg-white min-h-screen w-full flex items-center justify-center relative"
    >
      <p className="absolute bg-black text-white text-sm top-4 left-[4vw] px-2 py-1 rounded font-geist-mono">
        Gray-Scott Reaction Diffusion System
      </p>

      <p className="absolute bg-black text-white text-sm top-12 left-[4vw] px-2 py-1 rounded font-geist-mono">
        Click & drag the pen to see the pattern
      </p>

      <div className="w-[92vw] h-[82vh] -mb-6 sm:mb-0">
        {message ? (
          <h4 className="font-geist-sans">{message}</h4>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseUp={handleMouseUp}
            onPointerUp={handleMouseUp}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onPointerDown={handleMouseDown}
            onPointerMove={handleMouseMove}
            className="w-full h-full border cursor-pen"
          ></canvas>
        )}
      </div>
    </section>
  );
}
