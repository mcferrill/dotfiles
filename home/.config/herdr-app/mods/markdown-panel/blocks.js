// Markdown as blocks, for editing a document in place: each block is a run of
// whole lines (a heading, a paragraph, a list, a table, a code fence, front
// matter, a blank line), and joining the blocks' lines gives back the file
// byte for byte. Tables also parse into cells and print back.

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}#{1,6}(\s|$)/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const ITEM = /^\s*([-*+]|\d{1,9}[.)])(\s|$)/;
const QUOTE = /^\s{0,3}>/;
const DIVIDER = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

const isTableStart = (lines, i) => lines[i].includes("|") && i + 1 < lines.length && DIVIDER.test(lines[i + 1]) && lines[i + 1].includes("-");
const startsBlock = (lines, i) => FENCE.test(lines[i]) || HEADING.test(lines[i]) || RULE.test(lines[i]) || isTableStart(lines, i);

// [{ kind, lines }]; kinds: front, code, heading, rule, table, list, quote,
// paragraph, blank.
export function parseBlocks(text) {
  const lines = text.split("\n"), out = [];
  let i = 0;
  const take = (kind, end) => { out.push({ kind, lines: lines.slice(i, end) }); i = end; };
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) take("front", end + 1);
  }
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { take("blank", i + 1); continue; }
    const fence = FENCE.exec(line);
    if (fence) {
      const mark = fence[1][0], size = fence[1].length;
      let j = i + 1;
      while (j < lines.length && !new RegExp(`^\\s{0,3}\\${mark}{${size},}\\s*$`).test(lines[j])) j++;
      take("code", Math.min(j + 1, lines.length));
      continue;
    }
    if (HEADING.test(line)) { take("heading", i + 1); continue; }
    if (RULE.test(line)) { take("rule", i + 1); continue; }
    if (isTableStart(lines, i)) {
      let j = i + 2;
      while (j < lines.length && lines[j].trim() && lines[j].includes("|")) j++;
      take("table", j);
      continue;
    }
    if (QUOTE.test(line)) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() && QUOTE.test(lines[j])) j++;
      take("quote", j);
      continue;
    }
    if (ITEM.test(line)) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() && (ITEM.test(lines[j]) || /^\s/.test(lines[j])) && !startsBlock(lines, j)) j++;
      take("list", j);
      continue;
    }
    let j = i + 1;
    while (j < lines.length && lines[j].trim() && !startsBlock(lines, j) && !QUOTE.test(lines[j]) && !ITEM.test(lines[j])) j++;
    take("paragraph", j);
  }
  return out;
}

export const joinBlocks = (blocks) => blocks.flatMap((b) => b.lines).join("\n");

// A heading's level and words, and back.
export function headingOf(line) {
  const m = /^\s{0,3}(#{1,6})\s*(.*?)\s*#*\s*$/.exec(line);
  return m ? { level: m[1].length, text: m[2] } : { level: 1, text: line };
}
export const headingLine = (level, text) => `${"#".repeat(level)} ${text.replace(/\n+/g, " ").trim()}`;

// A row's cells: split on pipes that aren't escaped, outer pipes dropped.
export function cellsOf(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let k = 0; k < s.length; k++) {
    if (s[k] === "\\" && s[k + 1] === "|") { cur += "|"; k++; }
    else if (s[k] === "|") { cells.push(cur.trim()); cur = ""; }
    else cur += s[k];
  }
  cells.push(cur.trim());
  return cells;
}

// { head: [...], align: ["left"|"center"|"right"|null], rows: [[...]] }
export function parseTable(lines) {
  const head = cellsOf(lines[0]);
  const align = cellsOf(lines[1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : null));
  const rows = lines.slice(2).map(cellsOf);
  const n = Math.max(head.length, ...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(Math.max(0, n - r.length)).fill("")];
  return { head: pad(head), align: [...align, ...Array(Math.max(0, n - align.length)).fill(null)].slice(0, n), rows: rows.map(pad) };
}

const cellText = (c) => String(c ?? "").replace(/\n+/g, " ").trim().replace(/\|/g, "\\|");
const dashes = (a) => (a === "center" ? ":---:" : a === "right" ? "---:" : a === "left" ? ":---" : "---");

export function tableLines(table) {
  const row = (cells) => `| ${cells.map(cellText).join(" | ")} |`;
  return [row(table.head), `|${table.align.map((a) => ` ${dashes(a)} `).join("|")}|`, ...table.rows.map(row)];
}
