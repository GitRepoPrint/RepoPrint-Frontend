/**
 * Abre o diálogo de impressão do browser (pré-visualização + "Guardar como PDF").
 * O título do documento é o nome de ficheiro que o browser sugere para o PDF.
 */
export function printReport(filename: string) {
  const originalTitle = document.title;
  document.title = filename;
  window.addEventListener("afterprint", () => { document.title = originalTitle; }, { once: true });
  window.print();
}
