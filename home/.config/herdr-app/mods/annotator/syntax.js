// Bounded, dependency-free lexical coloring. No HTML, code execution or source
// rewriting. Unsupported languages and oversized/token-heavy lines stay plain.
const WORDS = {
  js: "as async await break case catch class const continue debugger default delete do else export extends finally for from function get if implements import in instanceof interface keyof let new of private protected public readonly return satisfies set static super switch this throw try type typeof var void while with yield declare namespace abstract override infer",
  rust: "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while",
  python: "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield",
  c: "abstract auto bool boolean break case catch char class const continue default defer do double else enum export extends final float for func function go if implements import int interface long namespace new package private protected public return short signed sizeof static string struct super switch synchronized template this throw throws trait try typedef typename union unsigned use using var virtual void volatile while",
  sql: "add all alter and as asc begin between by case check column commit constraint create cross database default delete desc distinct drop else end exists false foreign from full group having in index inner insert into is join key left like limit not null offset on or order outer primary references right rollback select set table then true union unique update values view when where with",
  shell: "case do done elif else esac export fi for function if in local readonly return select then time until while",
};
const KEYWORDS = Object.fromEntries(Object.entries(WORDS).map(([name, words]) => [name, new Set(words.split(" "))]));
const LITERALS = new Set("true false null undefined NaN Infinity None True False nil NULL TRUE FALSE".split(" "));
const TYPES = new Set("u8 u16 u32 u64 u128 usize i8 i16 i32 i64 i128 isize f32 f64 str bool char string number boolean any unknown never object".split(" "));

export function syntaxLanguage(path) {
  const name = path.split("/").pop().toLowerCase(), ext = name.split(".").pop();
  if (["js", "jsx", "ts", "tsx", "mjs", "cjs", "mts", "cts"].includes(ext)) return "js";
  if (ext === "rs") return "rust";
  if (["py", "pyi"].includes(ext)) return "python";
  if (["c", "h", "cc", "cpp", "hpp", "cs", "java", "go", "swift", "kt", "php"].includes(ext)) return "c";
  if (["json", "jsonc"].includes(ext)) return "json";
  if (["yaml", "yml", "toml", "ini", "conf"].includes(ext)) return "config";
  if (["sh", "bash", "zsh", "fish"].includes(ext) || name === "dockerfile" || name === "makefile") return "shell";
  if (ext === "sql") return "sql";
  if (["css", "scss", "less"].includes(ext)) return "css";
  if (["html", "xml", "svg"].includes(ext)) return "html";
  return null;
}

function quoteEnd(text, start, quote) {
  for (let i = start; i < text.length; i++) {
    if (text[i] === "\\") { i++; continue; }
    if (text.startsWith(quote, i)) return i + quote.length;
  }
  return -1;
}

export function syntaxTokens(text, language, state = {}) {
  if (!language || text.length > 8192) return [{ text, kind: "plain" }];
  const tokens = [];
  const add = (value, kind) => {
    if (!value) return;
    const previous = tokens.at(-1);
    if (previous?.kind === kind) previous.text += value;
    else tokens.push({ text: value, kind });
  };
  const lineComment = ["python", "config", "shell"].includes(language) ? "#" : language === "sql" ? "--" : language === "html" ? null : "//";
  const blockStart = language === "html" ? "<!--" : ["js", "rust", "c", "json", "css", "sql"].includes(language) ? "/*" : null;
  const blockEnd = language === "html" ? "-->" : "*/";
  let i = 0, steps = 0;
  while (i < text.length) {
    if (++steps > 512 || tokens.length > 200) {
      state.block = false; state.quote = null;
      return [{ text, kind: "plain" }];
    }
    if (state.block) {
      const end = text.indexOf(blockEnd, i);
      const stop = end < 0 ? text.length : end + blockEnd.length;
      add(text.slice(i, stop), "comment"); i = stop;
      state.block = end < 0; continue;
    }
    if (state.quote) {
      const end = quoteEnd(text, i, state.quote);
      add(text.slice(i, end < 0 ? text.length : end), "string");
      i = end < 0 ? text.length : end;
      if (end >= 0) state.quote = null;
      continue;
    }
    if (lineComment && text.startsWith(lineComment, i)) { add(text.slice(i), "comment"); break; }
    if (blockStart && text.startsWith(blockStart, i)) {
      const end = text.indexOf(blockEnd, i + blockStart.length);
      const stop = end < 0 ? text.length : end + blockEnd.length;
      add(text.slice(i, stop), "comment"); i = stop; state.block = end < 0; continue;
    }
    const char = text[i];
    const lifetime = language === "rust" && char === "'" ? /^'[A-Za-z_][A-Za-z0-9_]*(?=[\s,>:;+)=\]\[&]|$)/.exec(text.slice(i))?.[0] : null;
    if (lifetime) { add(lifetime, "type"); i += lifetime.length; continue; }
    if (char === '"' || char === "'" || (char === "`" && language === "js")) {
      const triple = language === "python" && text.startsWith(char.repeat(3), i);
      const quote = triple ? char.repeat(3) : char;
      const end = quoteEnd(text, i + quote.length, quote);
      // Rust lifetimes are identifiers, not unterminated character literals.
      if (language === "rust" && char === "'" && end < 0) { add(char, "plain"); i++; continue; }
      const stop = end < 0 ? text.length : end;
      const key = ["json", "config"].includes(language) && end >= 0 && /^\s*:/.test(text.slice(end));
      add(text.slice(i, stop), key ? "property" : "string");
      if (end < 0 && (triple || char === "`")) state.quote = quote;
      i = stop; continue;
    }
    if (!/[A-Za-z_$\d]/.test(char)) {
      let end = i + 1;
      while (end < text.length && !/[A-Za-z_$\d"'`]/.test(text[end])
        && !(lineComment && text.startsWith(lineComment, end))
        && !(blockStart && text.startsWith(blockStart, end))) end++;
      add(text.slice(i, end), "plain"); i = end; continue;
    }
    const rest = text.slice(i);
    const word = /^[A-Za-z_$][\w$]*/.exec(rest)?.[0];
    if (word) {
      const following = text.slice(i + word.length);
      const keyword = language === "sql" ? word.toLowerCase() : word;
      const kind = LITERALS.has(word) ? "literal" : KEYWORDS[language]?.has(keyword) ? "keyword"
        : ["json", "config"].includes(language) && /^\s*[:=]/.test(following) ? "property"
        : /^\s*\(/.test(following) ? "function" : TYPES.has(word) || /^[A-Z]/.test(word) ? "type" : "plain";
      add(word, kind); i += word.length; continue;
    }
    const number = /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)/.exec(rest)?.[0];
    if (number) { add(number, "number"); i += number.length; continue; }
    add(char, "plain"); i++;
  }
  return tokens.length > 200 ? [{ text, kind: "plain" }] : tokens;
}

// Old/new lexers advance independently: removed delimiters must not color added
// lines. Hidden gaps reset state rather than inventing the omitted source.
export function highlightDiff(rows, path) {
  const language = syntaxLanguage(path), result = new Map();
  if (!language) return result;
  const sides = { old: { line: null, state: {} }, new: { line: null, state: {} } };
  for (const row of rows) for (const side of ["old", "new"]) {
    if (row[side] == null) continue;
    const lexer = sides[side];
    if (lexer.line == null || row[side] !== lexer.line + 1) lexer.state = {};
    result.set(`${side}:${row[side]}`, syntaxTokens(row.text, language, lexer.state));
    lexer.line = row[side];
  }
  return result;
}
