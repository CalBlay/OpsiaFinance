/** Descarrega un Blob al navegador. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // No revocar immediatament: el navegador encara està llegint el Blob
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
