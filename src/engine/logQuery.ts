import type {
  LogEvent,
  QueryAst,
  QueryParseResult,
  QueryPredicate,
  QueryResult,
  TimeRange,
} from '@/content/types';

/**
 * Splits on whitespace, but keeps double-quoted runs together so
 * `message="exec session started"` survives as a single token.
 */
function tokenize(input: string): string[] | null {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of input) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(char)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (inQuotes) return null;
  if (current) tokens.push(current);
  return tokens;
}

export function parseQuery(input: string): QueryParseResult {
  const tokens = tokenize(input.trim());
  if (tokens === null) return { ok: false, error: 'Unterminated quote in query.' };

  const predicates: QueryPredicate[] = [];
  const terms: string[] = [];

  for (const token of tokens) {
    const negated = token.startsWith('-');
    const body = negated ? token.slice(1) : token;
    const equalsAt = body.indexOf('=');

    if (equalsAt === -1) {
      terms.push(body);
      continue;
    }

    const field = body.slice(0, equalsAt);
    const value = body.slice(equalsAt + 1);
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
 */
function fieldValue(event: LogEvent, field: string): string | undefined {
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
