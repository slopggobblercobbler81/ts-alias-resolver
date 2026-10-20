# ts-alias-resolver

A CLI utility that reads `tsconfig.json` paths and validates that all path aliases resolve to existing filesystem files/directories, detecting broken imports and dead aliases.

## Installation

```bash
npm install -g ts-alias-resolver
```

## Usage

```bash
ts-alias-resolver --tsconfig ./tsconfig.json
```

### Options

- `--tsconfig <path>`: Path to tsconfig.json (default: `tsconfig.json`)
- `--fix`: Attempt to clean or report suggestions (or remove dead mappings)
- `--json`: Output results in JSON format

## License

MIT
