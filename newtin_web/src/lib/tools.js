// --- String helpers ---

export function normalize(value) {
  return value.trim().toUpperCase();
}

export function stripSeparators(value) {
  return value.replace(/[\s.\-+]/g, '');
}

export function isEmpty(value) {
  return !value || value.trim().length === 0;
}

// --- Formatting ---

export function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date) {
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

// --- Clipboard ---

export async function copyToClipboard(text) {
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// --- Function utilities ---

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// --- Country entry transformer ---

export function transformCountryEntry(input) {
  const sanitizeLine = (line) => {
    const noQuotes = line.replace(/["']/g, '');
    return noQuotes.replace(/^[^A-Za-z0-9]+/, '');
  };

  const parseLines = (templateStr) =>
    templateStr
      .split('\n')
      .map(sanitizeLine)
      .filter((line) => line.length > 0);

  const exampleLines = parseLines(input.examples);
  const descLines = parseLines(input.description);

  return {
    code: input.country,
    name: input.name,
    pattern: new RegExp(input.regExp),
    format: null,
    example: exampleLines[0] ?? '',
    moreExamples: exampleLines.slice(1),
    description: descLines[0] ?? '',
    rules: descLines.slice(1),
  };
}

// --- Array helpers ---

export function uniqueById(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function limitTo(arr, max) {
  return arr.slice(0, max);
}
