const fs = require('fs');
const path = require('path');

const packages = [
  'bangumi-openapi',
  'bangumi-transport',
  'bangumi-core',
  'auth',
  'tools',
  'renderer',
  'platform-core',
  'platform-qq-official',
  'platform-onebot',
  'legacy-command-adapter',
  'html-providers',
  'db',
  'config',
  'observability',
];

const apps = ['api', 'mcp', 'bot', 'worker'];

for (const pkg of packages) {
  const dir = path.join(__dirname, '..', 'packages', pkg);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });

  const pkgJson = {
    name: `@bangumi-agent-kit/${pkg}`,
    version: '0.1.0',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
    },
  };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  const tsconfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
  };
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  fs.writeFileSync(
    path.join(dir, 'src', 'index.ts'),
    `// Export module: ${pkg}\nexport const MODULE_NAME = '${pkg}';\n`,
  );
}

for (const app of apps) {
  const dir = path.join(__dirname, '..', 'apps', app);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });

  const pkgJson = {
    name: `@bangumi-agent-kit/app-${app}`,
    version: '0.1.0',
    main: 'dist/main.js',
    scripts: {
      build: 'tsc',
    },
  };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  const tsconfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
  };
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  fs.writeFileSync(
    path.join(dir, 'src', 'main.ts'),
    `// Main entrypoint for app: ${app}\nconsole.log('App starting: ${app}');\n`,
  );
}

// Also ensure directories like openapi, skills, templates, tests are created
const otherDirs = [
  'skills/bangumi-assistant/references',
  'skills/bangumi-assistant/scripts',
  'templates/subject-card',
  'templates/search-list',
  'templates/calendar',
  'templates/user-profile',
  'templates/collection-progress',
  'templates/character-card',
  'templates/person-card',
  'templates/index-card',
  'templates/auth-card',
  'templates/error-card',
  'openapi/upstream',
  'openapi/patches',
  'tests/unit',
  'tests/contract',
  'tests/integration',
  'tests/render',
  'tests/html-fixtures',
  'tests/evals',
  'docs/adr',
];

for (const dir of otherDirs) {
  fs.mkdirSync(path.join(__dirname, '..', dir), { recursive: true });
}

console.log('Workspace directories and package skeletons successfully created!');
