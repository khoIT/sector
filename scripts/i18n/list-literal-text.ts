import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';

/**
 * Every piece of user-visible English still hard-coded in a component.
 *
 *   npx tsx scripts/i18n/list-literal-text.ts apps/web/src/features/create-scan
 *
 * The shell offers seven languages, so a Spanish learner who uploads a scan
 * meets English the moment they leave the navigation. This finds what is left,
 * and `apps/web/src/i18n/no-literal-jsx-text.test.ts` runs the same walk as a
 * ratchet so the count can only go down.
 *
 * Reported: JSX text nodes with a word in them; string literals RENDERED by a
 * JSX expression (`{busy ? 'Saving…' : 'Save'}`, which is text on screen just
 * as much as a text node is); and the attributes a reader actually hears or
 * sees — `title`, `aria-label`, `placeholder`, `alt`, `aria-description`.
 *
 * NOT reported: `className`, `href`, `src`, `type`, `role`, `data-*`, `id`,
 * anything already inside `t(...)`, and any literal in an ATTRIBUTE
 * expression — `className={cn('flex …')}` is a class list, not a sentence.
 *
 * A genuine non-translatable — a unit, a product name, a file extension —
 * carries `{/* i18n-exempt: reason *\/}` on the line above, or `// i18n-exempt`
 * for an attribute.
 */

const TRANSLATABLE_ATTRIBUTES = new Set([
  'title',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'placeholder',
  'alt',
  'label',
  // Copy props, not DOM attributes: `<StageMessage title detail/>` and
  // `<CardDescription description/>` put both straight on screen.
  'detail',
  'description',
]);

export type LiteralText = {
  file: string;
  line: number;
  kind: 'jsx-text' | 'jsx-expression' | 'attribute';
  attribute?: string;
  text: string;
};

/**
 * A literal the code COMPARES rather than shows: `block.kind === 'heading'`,
 * `case 'video':`, `typeof x === 'number'`. Never on screen.
 */
function isComparisonOperand(node: ts.Node): boolean {
  const parent = node.parent;
  if (parent && ts.isCaseClause(parent)) return true;
  if (!parent || !ts.isBinaryExpression(parent)) return false;

  const operator = parent.operatorToken.kind;
  return (
    operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    operator === ts.SyntaxKind.EqualsEqualsToken ||
    operator === ts.SyntaxKind.ExclamationEqualsToken
  );
}

/**
 * A literal that becomes a JSX TAG rather than text: `const List =
 * block.ordered ? 'ol' : 'ul'`. The capitalised binding is the convention that
 * makes it usable as a component, and it is what tells the two apart.
 */
function isTagNameBinding(node: ts.Node): boolean {
  for (let cursor = node.parent; cursor; cursor = cursor.parent) {
    if (ts.isVariableDeclaration(cursor)) {
      return ts.isIdentifier(cursor.name) && /^[A-Z]/.test(cursor.name.text);
    }
    // Only look through the expression forms a tag choice is written with.
    if (
      !ts.isConditionalExpression(cursor) &&
      !ts.isArrayLiteralExpression(cursor) &&
      !ts.isAsExpression(cursor) &&
      !ts.isParenthesizedExpression(cursor) &&
      !ts.isElementAccessExpression(cursor) &&
      !ts.isBinaryExpression(cursor)
    ) {
      return false;
    }
  }
  return false;
}

/**
 * A literal handed to a FUNCTION rather than rendered: the option bag in
 * `toLocaleTimeString(undefined, { hour: '2-digit' })`, a key passed to a
 * lookup. If a call's own output is user-visible, the string belongs in the
 * bundle on the other side of that call.
 */
function isCallArgument(node: ts.Node, stop: ts.Node): boolean {
  for (let cursor = node.parent; cursor && cursor !== stop; cursor = cursor.parent) {
    if (ts.isCallExpression(cursor) || ts.isNewExpression(cursor)) {
      return (cursor.arguments ?? []).some(
        (argument) => argument === node || argument.getStart() <= node.getStart(),
      );
    }
  }
  return false;
}

/** Already translated: `t('x')`, `i18n.t('x')`, `translate('x')`. */
function isTranslationCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === 't' || callee.text === 'translate';
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 't';
}

/** Whether any ancestor up to `stop` is a call that already translates. */
function insideTranslationCall(node: ts.Node, stop: ts.Node): boolean {
  for (let cursor = node.parent; cursor && cursor !== stop; cursor = cursor.parent) {
    if (ts.isCallExpression(cursor) && isTranslationCall(cursor)) return true;
  }
  return false;
}

/** The literal parts of a template, with each `${…}` shown as a placeholder. */
function templateText(node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral): string {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return [node.head.text, ...node.templateSpans.map((span) => `\${…}${span.literal.text}`)].join(
    '',
  );
}

/** A word, rather than punctuation, a number or a single symbol. */
function looksTranslatable(raw: string): boolean {
  const text = raw.trim();
  if (text.length < 2) return false;
  // Two or more letters in a row, somewhere.
  if (!/\p{Letter}{2}/u.test(text)) return false;
  // An interpolation-only node such as `{count}` is not text.
  return !/^[{}\s]*$/.test(text);
}

function isExempt(source: ts.SourceFile, node: ts.Node): boolean {
  const text = source.getFullText();
  const lines = text.split('\n');

  // Checked on the node AND on its ancestors: an exemption written above a
  // block exempts what is inside it, which is the only place it can go for a
  // literal buried a few lines down in an array or a ternary.
  for (let cursor: ts.Node | undefined = node; cursor; cursor = cursor.parent) {
    if (ts.isSourceFile(cursor)) break;

    const leading = text.slice(cursor.getFullStart(), cursor.getStart(source));
    if (/i18n-exempt/.test(leading)) return true;

    const { line } = source.getLineAndCharacterOfPosition(cursor.getStart(source));
    if (line > 0 && /i18n-exempt/.test(lines[line - 1] ?? '')) return true;
  }
  return false;
}

export function findLiteralText(file: string, code: string): LiteralText[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: LiteralText[] = [];

  function report(node: ts.Node, entry: Omit<LiteralText, 'file' | 'line'>) {
    if (isExempt(source, node)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push({ file, line: line + 1, ...entry });
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node) && looksTranslatable(node.text)) {
      report(node, { kind: 'jsx-text', text: node.text.trim().replace(/\s+/g, ' ') });
    }

    // A literal the JSX RENDERS, rather than one it passes to a function.
    // Only expressions in CHILD position: an attribute expression is where
    // `className={cn('flex …')}` lives, and a class list is not a sentence.
    if (
      ts.isJsxExpression(node) &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      node.expression
    ) {
      const container = node;
      const collect = (child: ts.Node) => {
        // Stop at nested JSX. The main walk reaches those elements on its own,
        // and descending into them from here would re-report their children
        // AND sweep up their attributes — which is where `cn('flex …')` lives.
        if (
          ts.isJsxElement(child) ||
          ts.isJsxSelfClosingElement(child) ||
          ts.isJsxFragment(child)
        ) {
          return;
        }
        if (
          (ts.isTemplateExpression(child) || ts.isNoSubstitutionTemplateLiteral(child)) &&
          looksTranslatable(templateText(child)) &&
          !isCallArgument(child, container) &&
          !insideTranslationCall(child, container)
        ) {
          report(child, { kind: 'jsx-expression', text: templateText(child) });
          return;
        }
        if (
          ts.isStringLiteral(child) &&
          looksTranslatable(child.text) &&
          !isComparisonOperand(child) &&
          !isTagNameBinding(child) &&
          !isCallArgument(child, container) &&
          !insideTranslationCall(child, container)
        ) {
          report(child, { kind: 'jsx-expression', text: child.text });
        }
        ts.forEachChild(child, collect);
      };
      collect(node.expression);
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      const value = node.initializer;
      if (TRANSLATABLE_ATTRIBUTES.has(name) && value) {
        // `title="Open"` and `title={'Open'}` both count; `title={t('x')}`
        // does not, because the expression is a call.
        // Searched, not just read: `title={busy ? 'Saving…' : 'Save'}` is two
        // sentences behind a ternary, and reading only the top-level
        // expression sees neither. Safe to search here BECAUSE the attribute
        // is already known to be one a reader hears — a class list can never
        // reach this branch.
        const shown: string[] = [];
        const collect = (child: ts.Node) => {
          if (
            ts.isJsxElement(child) ||
            ts.isJsxSelfClosingElement(child) ||
            ts.isJsxFragment(child)
          )
            return;
          // Checked per literal, not per attribute: `title={t('a.b')}` and
          // `title={busy ? t('a') : 'Save'}` differ one literal at a time.
          const translated = insideTranslationCall(child, node);
          if (ts.isStringLiteral(child) && !isComparisonOperand(child) && !translated) {
            shown.push(child.text);
          } else if (
            !translated &&
            (ts.isTemplateExpression(child) || ts.isNoSubstitutionTemplateLiteral(child))
          ) {
            shown.push(templateText(child));
          }
          ts.forEachChild(child, collect);
        };
        collect(ts.isJsxExpression(value) ? (value.expression ?? value) : value);

        for (const text of shown) {
          if (looksTranslatable(text)) report(node, { kind: 'attribute', attribute: name, text });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return found;
}

export function walkTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walkTsx(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

export function scanDirectory(dir: string): LiteralText[] {
  return walkTsx(dir).flatMap((file) => findLiteralText(file, readFileSync(file, 'utf8')));
}

// Run directly: print one line per finding, then a count per directory.
if (process.argv[1]?.endsWith('list-literal-text.ts')) {
  const dirs = process.argv.slice(2);
  let total = 0;

  for (const dir of dirs) {
    const found = scanDirectory(dir);
    total += found.length;
    for (const entry of found) {
      const where =
        entry.kind === 'attribute'
          ? `${entry.attribute}=`
          : entry.kind === 'jsx-expression'
            ? 'expr'
            : 'text';
      console.log(
        `${relative(process.cwd(), entry.file)}:${entry.line}  ${where.padEnd(12)} ${entry.text.slice(0, 90)}`,
      );
    }
    console.log(`\n${found.length} literal string(s) in ${dir}\n`);
  }

  console.log(`${total} total`);
}
