/**
 * Validates every bundled book before it can be built or published.
 *
 * The rule that matters most is `visibility-missing`: publication has to be a
 * decision an author made, not a consequence of where a folder sits
 * (SPEC003 D1 / E1.1).
 *
 *   npm run lint:content
 */
import { listBookFolders, readDescriptor, validateBook } from './book-sources.mjs';

const folders = listBookFolders();
const problems = folders.flatMap(validateBook);

for (const { folder, rule, message } of problems) {
  console.error(`books/${folder}/smartbook.json: ${rule}: ${message}`);
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) in ${folders.length} book(s).`);
  process.exit(1);
}

// Show what would reach the public site, so an unintended addition is visible
// in a CI log and in a diff.
const published = folders.filter((folder) => readDescriptor(folder).visibility === 'public');
console.log(`${folders.length} book(s) checked, no problems.`);
console.log(`published: ${published.length ? published.join(', ') : '(none)'}`);
