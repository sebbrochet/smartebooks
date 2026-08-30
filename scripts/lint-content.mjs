/**
 * Validates every bundled book before it can be built or published.
 *
 * Two passes: the descriptor (does this book declare what it is?) and the
 * content (does it use islands it actually has?). The rule that matters most is
 * `visibility-missing`: publication has to be a decision an author made, not a
 * consequence of where a folder sits (SPEC003 D1 / E1.1).
 *
 *   npm run lint:content
 */
import { listBookFolders, readDescriptor, validateBook } from './book-sources.mjs';
import { validateBookContent } from './lint-islands.mjs';

const folders = listBookFolders();

// Content checks read the descriptor, so only run them where it is sound.
const problems = folders.flatMap((folder) => {
  const descriptorProblems = validateBook(folder);
  return descriptorProblems.length > 0 ? descriptorProblems : validateBookContent(folder);
});

/**
 * One diagnostic, as `path:line: severity rule: message`.
 *
 * The path is **workspace-relative** and the line is its own field, so the
 * output is a location an editor can jump to (see `.vscode/tasks.json`) rather
 * than prose a reader has to decode. The same shape is what an agent needs to
 * act on its own feedback (SPEC007 G4).
 */
function format({ folder, file, line, rule, message, severity }) {
  const where = `books/${folder}/${file ?? 'smartbook.json'}:${line ?? 1}`;
  return `${where}: ${severity === 'warning' ? 'warning' : 'error'} ${rule}: ${message}`;
}

for (const problem of problems) {
  const line = format(problem);
  if (problem.severity === 'warning') console.warn(line);
  else console.error(line);
}

// Warnings exist so a rename can land without breaking every book at once:
// they are reported, and they do not fail the build.
const errors = problems.filter((problem) => problem.severity !== 'warning');
const warnings = problems.length - errors.length;

if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s) in ${folders.length} book(s).`);
  process.exit(1);
}

// Show what would reach the public site, so an unintended addition is visible
// in a CI log and in a diff.
const published = folders.filter((folder) => readDescriptor(folder).visibility === 'public');
console.log(
  `${folders.length} book(s) checked, no problems${warnings > 0 ? ` (${warnings} warning(s))` : ''}.`,
);
console.log(`published: ${published.length ? published.join(', ') : '(none)'}`);
