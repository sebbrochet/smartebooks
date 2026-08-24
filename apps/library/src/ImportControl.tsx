import { useRef, useState } from 'react';
import { parseSmartbook, saveImportedBook } from '@smart-ebooks/engine';

/**
 * Import a `.smartbook` package (untrusted). Parses + validates client-side,
 * stores it locally, then asks the shelf to reload.
 */
export function ImportControl({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pkg = parseSmartbook(bytes);
      const stored = await saveImportedBook(pkg);
      setStatus(`Imported “${stored.descriptor.title}”.`);
      onImported();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed.');
    }
  }

  return (
    <div className="shelf__import">
      <button type="button" className="reader__reset" onClick={() => fileRef.current?.click()}>
        Import book
      </button>
      <input
        ref={fileRef}
        type="file"
        data-testid="import-book-input"
        accept=".zip,.smartbook,application/zip"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />
      {status && (
        <span className="reader__backup-status" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
