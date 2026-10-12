const fs = require('fs');
const path = require('path');
function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    let full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      let content = fs.readFileSync(full, 'utf8');
      if (content.includes('http://localhost:3001')) {
        fs.writeFileSync(full, content.replace(/http:\/\/localhost:3001/g, ''));
        console.log('Updated', full);
      }
    }
  });
}
walk('./frontend/src');
