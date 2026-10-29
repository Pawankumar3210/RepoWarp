type CaptureFunction = () => HTMLCanvasElement | null;

let captureFunction: CaptureFunction | null = null;

export function registerSceneCapture(fn: CaptureFunction | null): void {
  captureFunction = fn;
}

export function captureSceneCanvas(): HTMLCanvasElement | null {
  if (!captureFunction) return null;
  try {
    return captureFunction();
  } catch {
    return null;
  }
}
