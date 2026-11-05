/** "org/repo" -> "org-repo": base para os nomes dos ficheiros exportados (PDF do relatório, SVG do DFD). */
export const fileBaseName = (repository: string) => repository.replace("/", "-");

/**
 * Descarrega um Blob como ficheiro.
 * O URL temporário só é libertado depois de o browser ter começado o download: revogá-lo logo a seguir
 * ao click() pode cancelar o download em alguns browsers (o click só agenda a navegação).
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link); // o Firefox antigo ignora click() em links fora do documento
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
