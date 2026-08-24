/**
 * A minimal Stockfish (WASM) client. Loads the single-threaded engine as a
 * classic Web Worker and speaks UCI. Pure parsers are exported for testing.
 */

export interface InfoLine {
  depth?: number;
  /** Centipawns from the side-to-move's perspective. */
  scoreCp?: number;
  /** Mate distance from the side-to-move's perspective. */
  mateIn?: number;
  /** Principal variation in UCI moves. */
  pv?: string[];
}

/** Parse a UCI `info …` line. Returns null for non-score/secondary lines. */
export function parseInfoLine(line: string): InfoLine | null {
  if (!line.startsWith('info ') || !line.includes('score ')) return null;
  const multipv = line.match(/\bmultipv\s+(\d+)/);
  if (multipv && Number.parseInt(multipv[1], 10) > 1) return null;
  if (line.includes(' upperbound') || line.includes(' lowerbound')) return null;

  const info: InfoLine = {};
  const depth = line.match(/\bdepth\s+(\d+)/);
  if (depth) info.depth = Number.parseInt(depth[1], 10);
  const cp = line.match(/\bscore cp\s+(-?\d+)/);
  if (cp) info.scoreCp = Number.parseInt(cp[1], 10);
  const mate = line.match(/\bscore mate\s+(-?\d+)/);
  if (mate) info.mateIn = Number.parseInt(mate[1], 10);
  const pv = line.match(/\bpv\s+(.+)$/);
  if (pv) info.pv = pv[1].trim().split(/\s+/);
  return info;
}

/** Parse a UCI `bestmove …` line into a UCI move (or null for none). */
export function parseBestMove(line: string): string | null {
  if (!line.startsWith('bestmove ')) return null;
  const move = line.split(/\s+/)[1];
  return move && move !== '(none)' ? move : null;
}

/** Worker URL for the single-threaded engine served from the app's public/. */
export function getStockfishUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}stockfish/stockfish-18-lite-single.js`;
}

type Listener = (line: string) => void;

export interface AnalyzeOptions {
  depth?: number;
  onInfo?: (info: InfoLine) => void;
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly url: string) {}

  private init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(this.url);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Stockfish failed to start'));
        return;
      }
      this.worker = worker;
      let sawUciOk = false;
      worker.onerror = () => reject(new Error('Stockfish failed to load'));
      worker.onmessage = (event: MessageEvent) => {
        const line = String(event.data ?? '');
        if (line === 'uciok') {
          sawUciOk = true;
          worker.postMessage('isready');
          return;
        }
        if (line === 'readyok' && sawUciOk) {
          resolve();
          return;
        }
        for (const listener of this.listeners) listener(line);
      };
      worker.postMessage('uci');
    });
    return this.ready;
  }

  /** Analyze a FEN to a fixed depth; resolves on `bestmove`. */
  async analyze(
    fen: string,
    options: AnalyzeOptions = {},
  ): Promise<{ bestMove: string | null; info?: InfoLine }> {
    await this.init();
    const worker = this.worker;
    if (!worker) throw new Error('Stockfish is not available');

    return new Promise((resolve) => {
      let last: InfoLine | undefined;
      const listener: Listener = (line) => {
        const info = parseInfoLine(line);
        if (info) {
          last = { ...last, ...info };
          options.onInfo?.(last);
          return;
        }
        if (line.startsWith('bestmove ')) {
          this.listeners.delete(listener);
          resolve({ bestMove: parseBestMove(line), info: last });
        }
      };
      this.listeners.add(listener);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${options.depth ?? 14}`);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.listeners.clear();
  }
}
