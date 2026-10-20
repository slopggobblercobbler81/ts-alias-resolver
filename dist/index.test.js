import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { parseTsConfig, resolveAliasPaths } from './index.js';
test('parseTsConfig parses simple config with comments and trailing commas', () => {
    const jsonContent = `
    {
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@app/*": ["src/*"]
        }
      }
    }
  `;
    const parsed = parseTsConfig(jsonContent);
    assert.strictEqual(parsed.compilerOptions.baseUrl, '.');
    assert.deepStrictEqual(parsed.compilerOptions.paths['@app/*'], ['src/*']);
});
test('resolveAliasPaths validates existing and missing paths correctly', () => {
    const tempDir = fs.mkdtempSync(path.join(path.resolve('.'), 'test-tmp-'));
    try {
        const srcDir = path.join(tempDir, 'src');
        fs.mkdirSync(srcDir);
        const tsconfigPath = path.join(tempDir, 'tsconfig.json');
        const tsconfigContent = {
            compilerOptions: {
                baseUrl: '.',
                paths: {
                    '@src/*': ['src/*'],
                    '@dead/*': ['nonexistent/*'],
                    '@missing-file': ['src/missing.ts']
                }
            }
        };
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));
        const result = resolveAliasPaths(tsconfigPath);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.totalChecked, 3);
        assert.strictEqual(result.issues.length, 2);
        const deadIssue = result.issues.find(i => i.alias === '@dead/*');
        assert.ok(deadIssue);
        const missingFileIssue = result.issues.find(i => i.alias === '@missing-file');
        assert.ok(missingFileIssue);
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
test('resolveAliasPaths succeeds when all paths exist', () => {
    const tempDir = fs.mkdtempSync(path.join(path.resolve('.'), 'test-tmp2-'));
    try {
        const srcDir = path.join(tempDir, 'src');
        fs.mkdirSync(srcDir);
        fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const x = 1;');
        const tsconfigPath = path.join(tempDir, 'tsconfig.json');
        const tsconfigContent = {
            compilerOptions: {
                baseUrl: '.',
                paths: {
                    '@src/*': ['src/*'],
                    '@entry': ['src/index.ts']
                }
            }
        };
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));
        const result = resolveAliasPaths(tsconfigPath);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.totalChecked, 2);
        assert.strictEqual(result.issues.length, 0);
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
