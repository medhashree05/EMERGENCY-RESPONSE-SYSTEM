const pkg = require('./package.json');
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const lines = Object.entries(deps).map(([k, v]) => `${k}@${v}`).join('\n');
console.log(lines);