/** A backgrounded browser must never leave the drawing permanently locked in Sending. */
export function drawingToPngBlob(canvas: Pick<HTMLCanvasElement, "toBlob">, timeoutMs = 8000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error("Preparing the image took too long. Your drawing is saved; please try sending again.")); }, timeoutMs);
    try {
      canvas.toBlob(blob => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (blob) resolve(blob); else reject(new Error("The sketch could not be prepared. Please try again."));
      }, "image/png");
    } catch (cause) { settled = true; clearTimeout(timer); reject(cause); }
  });
}
