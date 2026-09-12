/**
 * The gamebook pack (SPEC011).
 *
 * The state model, the condition vocabulary and the linter's rules — no islands
 * yet, and none of this touches React or the shell. All three are settled
 * before any markup because all three are expensive to change once a book
 * exists: K2.7 decides what a visit costs, QG4 decides what a condition may
 * even be since the fallback has to print it, and K4 is the part that would be
 * hardest to retrofit (§8).
 */
export * from './journey';
export * from './condition';
export * from './check';
