export function checkWebGPUSupport() {
  if (!navigator.gpu) {
    return false;
  }

  return true;
}
