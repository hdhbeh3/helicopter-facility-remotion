// Syntax-level check of every .ts/.tsx file using the TypeScript parser (no type resolution needed).
import {createRequire} from 'node:module';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (f === 'node_modules' || f.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f)) files.push(p);
  }
};
['src', 'scripts'].forEach(walk);
files.push('remotion.config.ts');
let bad = 0;
for (const f of files) {
  const out = ts.transpileModule(readFileSync(f, 'utf8'), {fileName: f, reportDiagnostics: true, compilerOptions: {jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}});
  const d = out.diagnostics || [];
  if (d.length) {
    bad += d.length;
    d.forEach((x) => console.log(`${f}: ${ts.flattenDiagnosticMessageText(x.messageText, '\n')}`));
  }
}
console.log(`syntax check: ${files.length} files, ${bad} syntax errors`);
process.exit(bad ? 1 : 0);
