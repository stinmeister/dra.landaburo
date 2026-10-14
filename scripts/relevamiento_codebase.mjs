import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

const appFiles = walk('src/app');
const pages = appFiles.filter(f => f.endsWith('page.tsx') || f.endsWith('page.js')).map(f => f.replace(/\\/g, '/'));
const routes = appFiles.filter(f => f.endsWith('route.ts') || f.endsWith('route.js')).map(f => f.replace(/\\/g, '/'));
const layouts = appFiles.filter(f => f.endsWith('layout.tsx') || f.endsWith('layout.js')).map(f => f.replace(/\\/g, '/'));

// Check for Server Actions (files with 'use server' or functions)
const allSrcFiles = walk('src');
const serverActionFiles = [];
for (const file of allSrcFiles) {
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes("'use server'") || content.includes('"use server"')) {
        serverActionFiles.push(file.replace(/\\/g, '/'));
      }
    } catch (e) {}
  }
}

// Components
const components = walk('src/components').map(f => f.replace(/\\/g, '/')).filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));

// Docs files
const docsFiles = fs.readdirSync('docs').map(f => f.replace(/\\/g, '/')).sort();

const summary = {
  timestamp: new Date().toISOString(),
  pages: pages.map(p => p.replace('src/app', '')),
  routes: routes.map(r => r.replace('src/app', '')),
  layouts: layouts.map(l => l.replace('src/app', '')),
  serverActionFiles,
  componentsCount: components.length,
  componentsList: components,
  docsFilesCount: docsFiles.length,
  docsFiles,
};

fs.writeFileSync('scripts/relevamiento_codebase_output.json', JSON.stringify(summary, null, 2));
console.log('Codebase relevamiento written to scripts/relevamiento_codebase_output.json');
console.log(`Pages: ${pages.length}, API Routes: ${routes.length}, Layouts: ${layouts.length}, Server Action Files: ${serverActionFiles.length}, Components: ${components.length}, Docs: ${docsFiles.length}`);
