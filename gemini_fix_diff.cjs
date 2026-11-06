// Repairs a diff that was copied as text from the Gemini chat, before git apply.
//
//   node gemini_fix_diff.cjs [changes.diff]     (run from the repo root; gemini_git.bat does it)
// .cjs so Node does not treat this as an ES module (package.json "type": "module").
//
// The chat renders text as Markdown, which does three things to a diff:
//   - non-breaking spaces and CRLF line ends            -> normalised
//   - the final newline is dropped                      -> added back
//   - comment lines become list bullets: context "  * text" and removed
//     "- * text" both turn into "- text"                -> restored from the file
// Context and removed lines exist in the current file, so each damaged line is
// matched against it and rewritten from the real file line. Whether it was
// context or removed is taken from its neighbours and checked against the
// hunk header counts. Added lines cannot be restored this way; git apply
// --check in the .bat still has the final word.
const fs = require('fs');

const diffPath = process.argv[2] || 'changes.diff';
// Built from its code: a literal or \u escape in this file is itself turned into a
// plain space when the file travels through the chat, and the replace becomes a no-op.
const NBSP = new RegExp(String.fromCharCode(160), 'g');
let text = fs.readFileSync(diffPath, 'utf8').replace(NBSP, ' ').replace(/\r\n/g, '\n');
// let text = fs.readFileSync(diffPath, 'utf8').replace(/ /g, ' ').replace(/\r\n/g, '\n');
if (!text.endsWith('\n')) text += '\n';
const lines = text.slice(0, -1).split('\n');

/** Text with list markers and indentation removed, for matching damaged lines. */
const bare = (s) => s.replace(/^\s*(?:[*+-]\s+)*/, '').trimEnd();

const out = [];
let baseLines = null;
let repaired = 0;
const problems = [];

let i = 0;
while (i < lines.length) {
  const line = lines[i];

  if (line.startsWith('diff --git ')) {
    baseLines = null;
    out.push(line);
    i++;
    continue;
  }
  if (line.startsWith('--- ')) {
    const name = line.slice(4).replace(/^a\//, '');
    baseLines = name !== '/dev/null' && fs.existsSync(name) ? fs.readFileSync(name, 'utf8').replace(/\r\n/g, '\n').split('\n') : null;
    out.push(line);
    i++;
    continue;
  }

  const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!header) {
    out.push(line);
    i++;
    continue;
  }

  const oldStart = Number(header[1]);
  const oldCount = header[2] === undefined ? 1 : Number(header[2]);
  const newCount = header[4] === undefined ? 1 : Number(header[4]);
  out.push(line);
  i++;

  // Collect the hunk body: classify each line as add / del / ctx / damaged.
  const body = [];
  let oldSeen = 0;
  let newSeen = 0;
  while (i < lines.length && (oldSeen < oldCount || newSeen < newCount)) {
    const l = lines[i];
    if (l.startsWith('\\')) {
      body.push({ kind: 'meta', text: l });
      i++;
      continue;
    }
    if (l.startsWith('diff --git ') || l.startsWith('@@ ')) break;
    const base = baseLines ? baseLines[oldStart - 1 + oldSeen] : undefined;
    if (l.startsWith('+')) {
      body.push({ kind: 'add', text: l });
      newSeen++;
    } else if ((l.startsWith(' ') || l === '') && (base === undefined || l.slice(1) === base)) {
      body.push({ kind: 'ctx', text: l });
      oldSeen++;
      newSeen++;
    } else if (l.startsWith('-') && (base === undefined || l.slice(1) === base)) {
      body.push({ kind: 'del', text: l });
      oldSeen++;
    } else if (base !== undefined && bare(l.slice(1)) === bare(base)) {
      // Markdown turns both a context line ("  * text") and a removed line
      // ("- * text") into "- text". The leading "-" is not proof of deletion.
      body.push({ kind: 'damaged', base });
      oldSeen++;
      newSeen++; // provisional; fixed below when it turns out to be a removal
    } else {
      problems.push(`${diffPath}:${i + 1} does not match the file: ${l.slice(0, 60)}`);
      body.push({ kind: l.startsWith('-') ? 'del' : 'ctx', text: l });
      oldSeen++;
      if (!l.startsWith('-')) newSeen++;
    }
    i++;
  }

  // Each damaged line is one old file line, kept or removed on its own
  // (a comment block is often a mix). Only a unique best fit is applied:
  // the line directly replaced by an addition was removed. A tie is left
  // broken so we do not delete context and make git apply search at EOF.
  const damagedIdx = [];
  for (let k = 0; k < body.length; k++) if (body[k].kind === 'damaged') damagedIdx.push(k);
  if (damagedIdx.length > 0) {
    const fixedNew = body.filter((b) => b.kind === 'ctx' || b.kind === 'add').length;
    const keepNeeded = newCount - fixedNew;
    let best = null;
    let ties = 0;
    if (damagedIdx.length <= 18 && keepNeeded >= 0 && keepNeeded <= damagedIdx.length) {
      for (let mask = 0; mask < (1 << damagedIdx.length); mask++) {
        let kept = 0;
        for (let b = 0; b < damagedIdx.length; b++) if (mask & (1 << b)) kept++;
        if (kept !== keepNeeded) continue;
        let score = 0;
        for (let b = 0; b < damagedIdx.length; b++) {
          const keep = (mask & (1 << b)) !== 0;
          const next = body[damagedIdx[b] + 1];
          if (next && next.kind === 'add') score += keep ? 0 : 3;
        }
        if (best === null || score > best.score) {
          best = { mask, score };
          ties = 1;
        } else if (score === best.score) ties++;
      }
    }
    if (best === null || ties !== 1) {
      problems.push(`${diffPath}: hunk "${line}" - no kept/removed combination matches the header`);
    } else {
      damagedIdx.forEach((k, b) => {
        const removal = !(best.mask & (1 << b));
        body[k] = { kind: removal ? 'del' : 'ctx', text: (removal ? '-' : ' ') + body[k].base };
        repaired++;
      });
    }
  }

  const oldTotal = body.filter((b) => b.kind === 'ctx' || b.kind === 'del').length;
  const newTotal = body.filter((b) => b.kind === 'ctx' || b.kind === 'add').length;
  const unresolved = body.some((b) => b.kind === 'damaged');
  if (!unresolved && oldTotal === oldCount && newTotal !== newCount) {
    // Chat dropped or Gemini miscounted a line. The body is what we can restore;
    // point the header at it so git apply --check can accept or reject it.
    out[out.length - 1] = line.replace(/\+(\d+)(?:,\d+)? @@/, `+$1,${newTotal} @@`);
    console.error(`${diffPath}: hunk "${line.slice(0, 40)}..." new-count ${newCount} -> ${newTotal}`);
  } else if (oldTotal !== oldCount || newTotal !== newCount) {
    problems.push(`${diffPath}: hunk "${line}" has ${oldTotal}/${newTotal} lines after repair, header says ${oldCount}/${newCount}`);
  }
  for (const b of body) out.push(b.text);
}

fs.writeFileSync(diffPath, out.join('\n') + '\n');
console.log(`${diffPath}: ${repaired} damaged line(s) restored`);
if (problems.length > 0) {
  problems.forEach((p) => console.error(p));
  process.exit(1);
}
