const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// Void / self-closing tags in HTML5
const voidTags = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

// SVG self-closing tags
const svgSelfClosing = new Set([
  'line', 'rect', 'circle', 'polyline', 'polygon', 'path'
]);

const tagRegex = /<\/?([a-zA-Z0-9-]+)(?:\s+[^>]*)?\/?>/g;
let match;
const stack = [];
let errors = 0;

let pos = 0;
while ((match = tagRegex.exec(html)) !== null) {
  const fullTag = match[0];
  const tagName = match[1].toLowerCase();
  const isClosing = fullTag.startsWith('</');
  const isSelfClosing = fullTag.endsWith('/>') || voidTags.has(tagName);

  if (isSelfClosing && !isClosing) {
    continue;
  }

  if (isClosing) {
    if (stack.length === 0) {
      console.error(`Unexpected closing tag </${tagName}> without matching opener near offset ${match.index}`);
      errors++;
    } else {
      const top = stack.pop();
      if (top.tagName !== tagName) {
        // SVG or optional tags might differ, let's log
        console.error(`Mismatched tag: expected </${top.tagName}> (from line ${top.line}), but found </${tagName}> near line ${html.slice(0, match.index).split('\n').length}`);
        errors++;
      }
    }
  } else {
    const line = html.slice(0, match.index).split('\n').length;
    stack.push({ tagName, line });
  }
}

if (stack.length > 0) {
  console.log(`Unclosed tags remaining on stack (${stack.length}):`, stack.slice(-5));
} else {
  console.log('All HTML tags matched and closed perfectly!');
}

console.log(`HTML audit finished with ${errors} mismatch errors.`);
