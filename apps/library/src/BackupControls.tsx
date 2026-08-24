import { useRef, useState } from 'react';
import { exportProgress, importProgress } from '@smart-ebooks/engine';

/**
 * Reader-state backup controls. Exports the reader's local progress (one book,
 * or all when `bookSlug` is omitted) as a JSON file, and restores it from one.
 * Personal state only — never book content.
 */
export function BackupControls({ bookSlug }: { bookSlug?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleExport() {
    const backup = await exportProgress(bookSlug);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const base = bookSlug ? `${bookSlug}-progress` : 'smart-ebooks-progress';
    anchor.href = url;
    anchor.download = `${base}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    try {
      const data = JSON.parse(await file.text());
      const result = await importProgress(data, 'merge');
      setStatus(
        `Imported ${result.entriesImported} item(s) across ${result.booksImported} book(s).`,
      );
      // Reload so every island re-reads its restored state.
      location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed.');
    }
  }

  const scopeLabel = bookSlug ? 'this book' : 'all books';

  return (
    <>
      <button
        type="button"
        className="reader__reset"
        onClick={handleExport}
        title={`Download a backup of progress for ${scopeLabel}`}
      >
        Export progress
      </button>
      <button
        type="button"
        className="reader__reset"
        onClick={() => fileRef.current?.click()}
        title="Restore progress from a backup file"
      >
        Import progress
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImportFile(file);
          event.target.value = '';
        }}
      />
      {status && (
        <span className="reader__backup-status" role="status">
          {status}
        </span>
      )}
    </>
  );
}
