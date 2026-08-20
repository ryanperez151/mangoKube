import type {
  LogEvent,
  QueryAst,
  QueryParseResult,
  QueryPredicate,
  QueryResult,
  TimeRange,
} from '@/content/types';

export interface ScannedToken {
  /**
   * Exact source text for this token, quotes and escapes untouched — what a
   * rewriter (see `logFields.applyValueFilter`) must reproduce verbatim for
   * the parts of the query it isn't touching.
   */
  raw: string;
  /**
   * Surrounding quotes removed and `\"` / `\\` resolved to literal
   * characters — what parsing and value comparisons operate on.
   */
  value: string;
}

/**
 * Splits on whitespace, but keeps double-quoted runs together so
 * `message="exec session started"` survives as a single token. `\"` and
 * `\\` escape inside a quoted run — the same minimal vocabulary Splunk
 * itself uses — so a value that carries its own quotes (an RBAC decision
 * naming a resource in quotes, say) round-trips through `applyValueFilter`
 * instead of mis-splitting on the next scan. Shared by `parseQuery`, which
 * needs the unescaped value, and `applyValueFilter`, which needs the raw
 * text to leave untouched predicates byte-for-byte alone.
 */
export function scanTokens(input: string): ScannedToken[] | null {
  const chars = Array.from(input);
  const tokens: ScannedToken[] = [];
  let raw = '';
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    if (inQuotes && char === '\\' && (chars[i + 1] === '"' || chars[i + 1] === '\\')) {
      raw += char + chars[i + 1];
      value += chars[i + 1];
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      raw += char;
      continue;
    }
    if (!inQuotes && /\s/.test(char)) {
      if (raw) tokens.push({ raw, value });
      raw = '';
      value = '';
      continue;
    }
    raw += char;
    value += char;
  }

  if (inQuotes) return null;
  if (raw) tokens.push({ raw, value });
  return tokens;
}

export interface SplitPredicate {
  field: string;
  value: string;
  negated: boolean;
}

/**
 * Splits an already-unescaped token (see `scanTokens`) into its `-`, field,
 * and value parts. Returns `null` only when there is no `=` anywhere in the
 * token — that's the one case ambiguous enough that the two callers need to
 * decide for themselves what it means (a bare search term for `parseQuery`,
 * "not a predicate, leave it alone" for `applyValueFilter`'s matcher). An
 * empty `field` or `value` is still a real split, just an invalid one —
 * `parseQuery` turns those into named parse errors, while the matcher in
 * `logFields.parseToken` treats them as "no match" and moves on, since a
 * malformed sub-token elsewhere in the query is not something a value click
 * should be rewriting.
 *
 * This one function used to be two: a single subtle divergence between them
 * (accepting `!=`, say) would have `parseQuery` running a predicate that
 * `applyValueFilter` could never recognize as already present, so a `+`
 * click would append a duplicate token instead of toggling the existing one
 * off — wrong output, no error, no test failure pointing at the cause.
 */
export function splitPredicate(token: string): SplitPredicate | null {
  const negated = token.startsWith('-');
  const body = negated ? token.slice(1) : token;
  const equalsAt = body.indexOf('=');
  if (equalsAt === -1) return null;

  return { field: body.slice(0, equalsAt), value: body.slice(equalsAt + 1), negated };
}

export function parseQuery(input: string): QueryParseResult {
  const tokens = scanTokens(input.trim());
  if (tokens === null) return { ok: false, error: 'Unterminated quote in query.' };

  const predicates: QueryPredicate[] = [];
  const terms: string[] = [];

  for (const scanned of tokens) {
    const token = scanned.value;
    const split = splitPredicate(token);

    if (split === null) {
      if (token.startsWith('-')) {
        return {
          ok: false,
          error: 'Negated bare terms are not supported — use -field=value.',
        };
      }
      terms.push(token);
      continue;
    }

    const { field, value, negated } = split;
    if (!field) return { ok: false, error: 'Missing field name before "=".' };
    if (!value) return { ok: false, error: `Missing value for field "${field}".` };

    predicates.push({ field, value, negated });
  }

  return { ok: true, ast: { predicates, terms } };
}

/**
 * `source` and `message` are promoted to queryable fields so players can
 * write `source=edr` without the content author duplicating them into
 * every event's `fields` bag.
 *
 * Exported because column rendering and field summaries read values through
 * this same accessor — one definition means a field can never become
 * queryable but not tableable, or the reverse.
 */
export function fieldValue(event: LogEvent, field: string): string | undefined {
  if (field === 'source') return event.source;
  if (field === 'message') return event.message;
  return event.fields[field];
}

function searchableText(event: LogEvent): string {
  return [event.source, event.message, ...Object.values(event.fields)].join(' ');
}

function matches(event: LogEvent, ast: QueryAst): boolean {
  for (const predicate of ast.predicates) {
    const value = fieldValue(event, predicate.field);
    const hit =
      value !== undefined && value.toLowerCase().includes(predicate.value.toLowerCase());
    if (hit === predicate.negated) return false;
  }

  const haystack = searchableText(event).toLowerCase();
  return ast.terms.every((term) => haystack.includes(term.toLowerCase()));
}

function inRange(event: LogEvent, range: TimeRange | undefined): boolean {
  if (!range) return true;
  const at = Date.parse(event.timestamp);
  return at >= Date.parse(range.startIso) && at < Date.parse(range.endIso);
}

export function executeQuery(
  ast: QueryAst,
  events: LogEvent[],
  range?: TimeRange
): QueryResult {
  const inWindow = events.filter((event) => inRange(event, range));

  const unknownFields = ast.predicates
    .map((predicate) => predicate.field)
    .filter(
      (field, index, all) =>
        all.indexOf(field) === index &&
        !inWindow.some((event) => fieldValue(event, field) !== undefined)
    );

  const matched = inWindow
    .filter((event) => matches(event, ast))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return { events: matched, unknownFields };
}
