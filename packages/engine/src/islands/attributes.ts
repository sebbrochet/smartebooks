/**
 * Declarative attribute schemas for islands (SPEC001 P1.2).
 *
 * Directive attributes arrive as strings, from content that may be untrusted.
 * Rather than every island re-implementing "is this a number, is this one of
 * my allowed values, what is the default", an island declares the shape it
 * wants and the engine coerces centrally.
 *
 * The runtime is deliberately **forgiving**: a bad value falls back to its
 * default rather than throwing, because a reader should never lose a page to a
 * typo — and an imported book must not be able to crash the app. The *linter*
 * is where bad values are reported, before anything is published.
 */

export type AttributeValue = string | number | boolean;

export type AttributeSpec =
  | { type: 'string'; required?: boolean; default?: string }
  | { type: 'number'; required?: boolean; default?: number; min?: number; max?: number }
  | { type: 'boolean'; default?: boolean }
  | { type: 'enum'; values: readonly string[]; required?: boolean; default?: string };

export interface AttributeProblem {
  attribute: string;
  /** Stable id so tooling can act on it, not just print it. */
  rule: 'attribute-required' | 'attribute-invalid';
  message: string;
}

export interface ResolvedAttributes {
  /** Coerced values, with defaults applied. Undeclared attributes pass through. */
  values: Record<string, AttributeValue>;
  problems: AttributeProblem[];
}

const TRUTHY = new Set(['', 'true', 'yes', 'on', '1']);
const FALSY = new Set(['false', 'no', 'off', '0']);

function coerce(
  name: string,
  spec: AttributeSpec,
  raw: string | undefined,
  problems: AttributeProblem[],
): AttributeValue | undefined {
  if (raw === undefined) {
    if ('required' in spec && spec.required) {
      problems.push({
        attribute: name,
        rule: 'attribute-required',
        message: `"${name}" is required.`,
      });
    }
    return spec.default;
  }

  switch (spec.type) {
    case 'string':
      return raw;

    case 'enum':
      if (spec.values.includes(raw)) return raw;
      problems.push({
        attribute: name,
        rule: 'attribute-invalid',
        message: `"${name}" must be one of ${spec.values.join(', ')} (got "${raw}").`,
      });
      return spec.default;

    case 'boolean': {
      // Bare `{analysis}` means true — the natural reading of a flag.
      const lowered = raw.toLowerCase();
      if (TRUTHY.has(lowered)) return true;
      if (FALSY.has(lowered)) return false;
      problems.push({
        attribute: name,
        rule: 'attribute-invalid',
        message: `"${name}" must be true or false (got "${raw}").`,
      });
      return spec.default;
    }

    case 'number': {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        problems.push({
          attribute: name,
          rule: 'attribute-invalid',
          message: `"${name}" must be a number (got "${raw}").`,
        });
        return spec.default;
      }
      if (spec.min !== undefined && parsed < spec.min) {
        problems.push({
          attribute: name,
          rule: 'attribute-invalid',
          message: `"${name}" must be at least ${spec.min} (got ${parsed}).`,
        });
        return spec.default ?? spec.min;
      }
      if (spec.max !== undefined && parsed > spec.max) {
        problems.push({
          attribute: name,
          rule: 'attribute-invalid',
          message: `"${name}" must be at most ${spec.max} (got ${parsed}).`,
        });
        return spec.default ?? spec.max;
      }
      return parsed;
    }
  }
}

/**
 * Coerce raw directive attributes against a schema.
 *
 * Attributes the schema does not mention are passed through untouched, so an
 * island can still read something it never declared, and adding a schema to an
 * existing island never removes data.
 */
export function resolveAttributes(
  specs: Record<string, AttributeSpec> | undefined,
  raw: Record<string, string>,
): ResolvedAttributes {
  if (!specs) return { values: { ...raw }, problems: [] };

  const problems: AttributeProblem[] = [];
  const values: Record<string, AttributeValue> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!(key in specs)) values[key] = value;
  }

  for (const [name, spec] of Object.entries(specs)) {
    const resolved = coerce(name, spec, raw[name], problems);
    if (resolved !== undefined) values[name] = resolved;
  }

  return { values, problems };
}

/** Read a value the schema declared as a string (or an undeclared attribute). */
export function attrText(value: AttributeValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** Read a value the schema declared as a boolean. */
export function attrFlag(value: AttributeValue | undefined, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Read a value the schema declared as a number. */
export function attrNumber(value: AttributeValue | undefined, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}
