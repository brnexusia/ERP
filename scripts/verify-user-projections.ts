/**
 * Regression gate: all query relations pointing to User must use explicit
 * field projections. Importing a full User into an API result may serialize
 * its passwordHash, even when the caller only needs the display name.
 *
 * AST-based so multiline includes and quoting cannot evade the check.
 * Scope covers runtime routes and services; test fixtures are not public APIs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const roots = ["app", "modules", "lib"];
const userRelations = new Set([
  "user",
  "createdBy",
  "approvedBy",
  "requestedBy",
  "decidedBy",
  "recordedBy",
  "separatedBy",
  "verifiedBy",
]);
const errors: string[] = [];

function unsafeRelations(source: string, filename: string) {
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
    filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: Array<{ relation: string; line: number }> = [];
  function walk(node: ts.Node) {
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
        ? node.name.text : "";
      if (userRelations.has(name) && node.initializer.kind === ts.SyntaxKind.TrueKeyword) {
        found.push({
          relation: name,
          line: sourceFile.getLineAndCharacterOfPosition(node.name.getStart(sourceFile)).line + 1,
        });
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sourceFile);
  return found;
}

function scan(folder: string) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      scan(path);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      const content = readFileSync(path, "utf8");
      for (const unsafe of unsafeRelations(content, path)) {
        errors.push(`${relative(".", path)}:${unsafe.line} — ${unsafe.relation}: true`);
      }
    }
  }
}

// Validate the gate's own behavior so it cannot silently stop detecting leaks.
assert.deepEqual(unsafeRelations("const q = { include: { user: true } };", "fixture.ts"),
  [{ relation: "user", line: 1 }]);
assert.deepEqual(unsafeRelations("const q = { include: { createdBy: true } };", "fixture.ts"),
  [{ relation: "createdBy", line: 1 }]);
assert.deepEqual(unsafeRelations("const q = { include: { user: { select: { id: true, name: true } } } };", "fixture.ts"), []);

for (const root of roots) scan(root);

if (errors.length) {
  console.error("Consulta(s) insegura(s) de User: use select explícito em vez de include completo:");
  for (const issue of errors) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log("✓ Todas as relações de usuário nos módulos e rotas têm projeção explícita.");
}
