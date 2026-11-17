const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
const css = fs.readFileSync(cssPath, 'utf8');

let braceCount = 0;
let line = 1;
let col = 0;
let inComment = false;

for (let i = 0; i < css.length; i++) {
  const c = css[i];
  if (c === '\n') {
    line++;
    col = 0;
  } else {
    col++;
  }

  if (inComment) {
    if (c === '*' && css[i + 1] === '/') {
      inComment = false;
      i++;
    }
    continue;
  }

  if (c === '/' && css[i + 1] === '*') {
    inComment = true;
    i++;
    continue;
  }

  if (c === '{') braceCount++;
  else if (c === '}') {
    braceCount--;
    if (braceCount < 0) {
      console.error(`Unmatched closing brace '}' at line ${line}, col ${col}`);
      process.exit(1);
    }
  }
}

if (braceCount !== 0) {
  console.error(`Unclosed opening brace: ${braceCount} unclosed '{' at end of file!`);
  process.exit(1);
}

console.log(`CSS syntax check passed! Length: ${css.length} characters, Lines: ${line}, Braces perfectly balanced.`);
