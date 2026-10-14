// npm install 時把 git hooks 指向 .githooks（分支保護，見 README「分支流程」）。
// 非 git 環境（如 Vercel build）直接略過，不讓安裝失敗。
const { execSync } = require('child_process');

try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
} catch {
  // 沒有 git 或不在 repo 內
}
