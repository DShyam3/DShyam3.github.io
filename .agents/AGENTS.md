# Agent Customizations

## Rules

### Always Fix Linting Issues (Errors & Warnings)

Whenever you modify any code files, you must run the lint check (`npm run lint`) to detect any syntax, typescript, formatting issues, errors, or warnings.
- You must always resolve all linting errors AND warnings in the modified files or codebase before ending your turn.
- The lint step must succeed with 0 errors and 0 warnings.
- If existing code triggers warnings or errors, you can adjust the `eslint.config.js` or fix the offending code directly to ensure the lint step succeeds with exit code 0 and no warnings.
