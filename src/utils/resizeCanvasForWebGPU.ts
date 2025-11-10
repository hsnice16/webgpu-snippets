export function resizeCanvasForWebGPU(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio;
  const displayWidth = Math.floor(canvas.clientWidth * dpr);
  const displayHeight = Math.floor(canvas.clientHeight * dpr);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    return true;
  }

  return false;
}
