/*
 * Declares that the suite is an `act` environment.
 *
 * This is not noise suppression — it is the opposite. React checks this flag
 * before it will warn that a state update escaped `act()`:
 *
 *     if (!isConcurrentActEnvironment()) {
 *       // Not in an act environment. No need to warn.
 *       return;
 *     }
 *     ...
 *     error('An update to %s inside a test was not wrapped in act(...).')
 *
 * (react-dom.development.js, warnIfUpdatesNotWrappedWithActDEV.)
 *
 * The flag was set in one test file and nowhere else, so for the other six that
 * diagnostic was silently off — and an update landing outside `act` is exactly
 * the shape of bug that makes a DOM assertion pass or fail on timing. Setting
 * it here turns the check on for the whole suite, which is clean under it.
 *
 * It is *not* what removed the 93 "environment is not configured to support
 * act(...)" warnings from CI; importing `act` from `react` instead of the
 * deprecated `react-dom/test-utils` did that. Flipping this flag to false
 * changes neither of those counts — measured, not assumed.
 *
 * Harmless in the default `node` environment, where nothing renders.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
