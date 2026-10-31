export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function fileBase(name: string, company?: string, title?: string): string {
  const part = (s?: string) => (s ?? "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
  return [part(name) || "Resume", part(company), part(title)].filter(Boolean).join("_");
}
