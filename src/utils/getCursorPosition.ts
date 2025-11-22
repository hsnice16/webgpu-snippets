export function getCursorPosition(
  eventClientX: number,
  eventClientY: number,
  canvas: HTMLCanvasElement
) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const clientRect = canvas.getBoundingClientRect();

  const mouseY = eventClientY - clientRect.top;
  const mouseX = eventClientX - clientRect.left;

  const posX = (mouseX - centerX) / centerX;
  const posY = (centerY - mouseY) / centerY;

  return {
    posX,
    posY,
  };
}
