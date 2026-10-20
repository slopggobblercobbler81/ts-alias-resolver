import * as fs from 'fs';
import * as path from 'path';
// Simple JSON5-like comment stripper for tsconfig.json parsing
export function parseTsConfig(content) {
    // Remove multi-line comments
    let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove single-line comments
    cleaned = cleaned.replace(/^\s*\/\/.*/gm, '');
    // Remove trailing commas in objects and arrays before closing bracket/brace
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
    // Use a more robust regex-based JSON cleaner or try/catch fallback with strip-json-comments approach
    try {
        return JSON.parse(cleaned);
    }
    catch (err) {
        // Basic cleanup of common unquoted keys or extra commas if any
        throw err;
    }
}
export function resolveAliasPaths(tsconfigPath) {
    const absoluteTsConfigPath = path.resolve(tsconfigPath);
    if (!fs.existsSync(absoluteTsConfigPath)) {
        throw new Error(`tsconfig.json not found at ${absoluteTsConfigPath}`);
    }
    const rawContent = fs.readFileSync(absoluteTsConfigPath, 'utf8');
    let config;
    try {
        config = parseTsConfig(rawContent);
    }
    catch (err) {
        throw new Error(`Failed to parse tsconfig.json: ${err.message}`);
    }
    const compilerOptions = config.compilerOptions || {};
    const baseUrl = compilerOptions.baseUrl
        ? path.resolve(path.dirname(absoluteTsConfigPath), compilerOptions.baseUrl)
        : path.dirname(absoluteTsConfigPath);
    const paths = compilerOptions.paths || {};
    const issues = [];
    let totalChecked = 0;
    for (const [aliasPattern, targets] of Object.entries(paths)) {
        if (!Array.isArray(targets))
            continue;
        for (const targetPattern of targets) {
            totalChecked++;
            // A target pattern usually contains '*' e.g. "src/*"
            // Let's handle the wildcard or exact path.
            const hasWildcard = aliasPattern.includes('*') && targetPattern.includes('*');
            if (hasWildcard) {
                const aliasPrefix = aliasPattern.split('*')[0];
                const targetPrefix = targetPattern.split('*')[0];
                const resolvedTargetDir = path.resolve(baseUrl, targetPrefix);
                if (!fs.existsSync(resolvedTargetDir) || !fs.statSync(resolvedTargetDir).isDirectory()) {
                    issues.push({
                        alias: aliasPattern,
                        pattern: targetPattern,
                        target: targetPrefix,
                        resolvedPath: resolvedTargetDir,
                        message: `Wildcard base directory does not exist or is not a directory: ${resolvedTargetDir}`
                    });
                }
            }
            else {
                // Exact path mapping
                const resolvedPath = path.resolve(baseUrl, targetPattern);
                const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.d.ts'];
                let exists = false;
                if (fs.existsSync(resolvedPath)) {
                    exists = true;
                }
                else {
                    // Try checking with common extensions if it points to a file without extension
                    for (const ext of extensions) {
                        if (fs.existsSync(resolvedPath + ext)) {
                            exists = true;
                            break;
                        }
                    }
                }
                if (!exists) {
                    issues.push({
                        alias: aliasPattern,
                        pattern: targetPattern,
                        target: targetPattern,
                        resolvedPath: resolvedPath,
                        message: `Path alias target does not exist on filesystem: ${resolvedPath}`
                    });
                }
            }
        }
    }
    return {
        valid: issues.length === 0,
        issues,
        totalChecked
    };
}
export async function runCli(args) {
    let tsconfigPath = 'tsconfig.json';
    let jsonOutput = false;
    let fixMode = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--tsconfig' && args[i + 1]) {
            tsconfigPath = args[++i];
        }
        else if (arg === '--json') {
            jsonOutput = true;
        }
        else if (arg === '--fix') {
            fixMode = true;
        }
    }
    try {
        const result = resolveAliasPaths(tsconfigPath);
        if (jsonOutput) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log(`Checking tsconfig: ${tsconfigPath}`);
            console.log(`Total path mappings checked: ${result.totalChecked}`);
            if (result.valid) {
                console.log('✨ All TypeScript path aliases resolve successfully!');
            }
            else {
                console.log(`❌ Found ${result.issues.length} broken or dead path alias(es):`);
                for (const issue of result.issues) {
                    console.log(`  - Alias: "${issue.alias}" -> "${issue.pattern}"`);
                    console.log(`    Resolved: ${issue.resolvedPath}`);
                    console.log(`    Reason: ${issue.message}`);
                }
                if (fixMode) {
                    console.log('\n[--fix specified]: Automatic fixing of dead paths is not fully automated yet, please update tsconfig.json manually.');
                }
                process.exit(1);
            }
        }
    }
    catch (err) {
        if (jsonOutput) {
            console.log(JSON.stringify({ error: err.message }, null, 2));
        }
        else {
            console.error(`Error: ${err.message}`);
        }
        process.exit(1);
    }
}
