import { exportBookToZip, type Book } from '@smart-ebooks/engine';

/**
 * Download the active book as a portable `.smartbook` package (a zip of its
 * `smartbook.json` + Markdown content). Content only — never reader progress.
 */
export function BookExport({ book }: { book: Book }) {
  function handleExport() {
    const bytes = exportBookToZip(book);
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${book.meta.slug}.smartbook.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      className="reader__reset"
      onClick={handleExport}
      title="Download this book as a .smartbook package"
    >
      Export book
    </button>
  );
}
