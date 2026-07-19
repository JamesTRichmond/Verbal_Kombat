import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal DOM-free test: read the source and verify the escaping behavior by
// evaluating the IIFE in a stubbed window context.
const source = fs.readFileSync(path.join(__dirname, 'htmlEscape.js'), 'utf8');

const VK = {};
const window = { VK };
// eslint-disable-next-line no-eval
eval(source);

assert.equal(VK.htmlEscape(null), '', 'null returns empty string');
assert.equal(VK.htmlEscape(undefined), '', 'undefined returns empty string');
assert.equal(VK.htmlEscape('plain text'), 'plain text', 'plain text unchanged');
assert.equal(VK.htmlEscape('<script>alert(1)</script>'),
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  'script tag escaped');
assert.equal(VK.htmlEscape('" onclick="evil()"'), '&quot; onclick=&quot;evil()&quot;', 'quotes escaped');
assert.equal(VK.htmlEscape("' or 1=1"), '&#39; or 1=1', 'single quote escaped');
assert.equal(VK.htmlEscape('a & b'), 'a &amp; b', 'ampersand escaped');

console.log('htmlEscape tests passed.');
