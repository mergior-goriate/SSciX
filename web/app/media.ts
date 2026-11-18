export function readImage(file: File, maxBytes: number): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return Promise.reject(new Error("Escolha uma imagem JPEG, PNG ou WebP."));
  }
  if (file.size > maxBytes) {
    return Promise.reject(new Error(`A imagem deve ter até ${Math.floor(maxBytes / 1024)} KB.`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}
