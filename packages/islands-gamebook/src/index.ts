/**
 * The gamebook pack (SPEC011).
 *
 * Only the journey so far: the state model is the spine of this domain and is
 * deliberately settled before any island, because getting K2.7 wrong charges
 * the reader twice for the same door — a bug a player finds and a test never
 * does (§8.2).
 */
export * from './journey';
