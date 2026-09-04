import { useRef, useState } from 'react';
import {
  bookIslandIds,
  importBook,
  makeImportedBook,
  orphanedState,
  parseSmartbook,
  previewImport,
  type ImportedPackage,
} from '@smart-ebooks/engine';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Import a `.smartbook` package (untrusted). Parses + validates client-side,
 * stores it locally, then asks the shelf to reload.
 *
 * Two things happen around the store call, and both exist because an import is
 * not always an improvement (SPEC003 E1.2):
 *
 * - A package **older than the copy the reader has** asks first. Silently
 *   replacing a book with last month's edition loses a month of corrections and
 *   reports "Imported" while doing it.
 * - After an update, any of the reader's work the new edition can no longer
 *   show is **reported, never deleted**. A dropped island id is usually a
 *   rename or a chapter pulled for editing, not a decision to destroy answers.
 */
export function ImportControl({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    pkg: ImportedPackage;
    replaced?: string;
  }>();

  async function store(pkg: ImportedPackage) {
    const { stored, outcome } = await importBook(pkg);
    const book = makeImportedBook(stored);

    // Nothing can be orphaned by a book this reader has never had.
    const orphans =
      outcome === 'new' ? [] : await orphanedState(book.meta.slug, bookIslandIds(stored.content));

    const named = orphans
      .slice(0, 3)
      .map((orphan) => orphan.id)
      .join(', ');

    setStatus(
      orphans.length === 0
        ? `Imported “${stored.descriptor.title}”.`
        : `Imported “${stored.descriptor.title}”. ${orphans.length} saved ${
            orphans.length === 1 ? 'answer is' : 'answers are'
          } not in this edition (${named}${orphans.length > 3 ? '…' : ''}). Nothing was deleted.`,
    );
    onImported();
  }

  async function handleFile(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pkg = parseSmartbook(bytes);

      const { outcome, replaced } = await previewImport(pkg);
      /*
       * Only a downgrade interrupts. An update, a duplicate, and a package
       * whose edition cannot be ordered all proceed: the reader chose this
       * file, and a prompt on every import teaches them to dismiss prompts —
       * which is how the one prompt that matters gets dismissed too.
       */
      if (outcome === 'downgrade') {
        setPending({ pkg, replaced });
        return;
      }

      await store(pkg);
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

      {pending && (
        <ConfirmDialog
          title={`Replace ${pending.pkg.descriptor.title} with an older edition?`}
          confirmLabel="Import anyway"
          onCancel={() => {
            setPending(undefined);
            setStatus('Import cancelled — you kept the edition you had.');
          }}
          onConfirm={() => {
            const { pkg } = pending;
            setPending(undefined);
            void store(pkg);
          }}
        >
          <p>
            This file is edition <b>{pending.pkg.descriptor.edition}</b>. You already have{' '}
            <b>{pending.replaced}</b>, which is newer.
          </p>
          {/* Said plainly, because the reader cannot see it: the risk here is
              to the book's text, not to their work. */}
          <p>Your progress is kept either way, but the book’s text will go back.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
