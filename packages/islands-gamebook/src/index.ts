/**
 * The gamebook pack (SPEC011).
 *
 * The state model and the condition vocabulary, no islands yet. Both are
 * settled before any markup because both are expensive to change once a book
 * exists: K2.7 decides what a visit costs, and QG4 decides what a condition may
 * even be, since the fallback has to print it (§8).
 */
export * from './journey';
export * from './condition';
