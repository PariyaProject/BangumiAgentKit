import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@bangumi-agent-kit/bangumi-openapi': path.resolve(
        __dirname,
        'packages/bangumi-openapi/src/index.ts',
      ),
      '@bangumi-agent-kit/bangumi-transport': path.resolve(
        __dirname,
        'packages/bangumi-transport/src/index.ts',
      ),
      '@bangumi-agent-kit/db': path.resolve(__dirname, 'packages/db/src/index.ts'),
      '@bangumi-agent-kit/auth': path.resolve(__dirname, 'packages/auth/src/index.ts'),
      '@bangumi-agent-kit/bangumi-core': path.resolve(
        __dirname,
        'packages/bangumi-core/src/index.ts',
      ),
      '@bangumi-agent-kit/tools': path.resolve(__dirname, 'packages/tools/src/index.ts'),
      '@bangumi-agent-kit/renderer': path.resolve(__dirname, 'packages/renderer/src/index.ts'),
      '@bangumi-agent-kit/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
      '@bangumi-agent-kit/platform-core': path.resolve(
        __dirname,
        'packages/platform-core/src/index.ts',
      ),
      '@bangumi-agent-kit/platform-qq-official': path.resolve(
        __dirname,
        'packages/platform-qq-official/src/index.ts',
      ),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  plugins: [
    {
      name: 'resolve-tsx-for-js',
      resolveId(id, importer) {
        if (id.endsWith('.js') && importer && importer.includes('/packages/renderer/src/')) {
          const tsxPath = path.resolve(path.dirname(importer), id.replace(/\.js$/, '.tsx'));
          if (fs.existsSync(tsxPath)) {
            return tsxPath;
          }
        }
        return null;
      },
    },
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
