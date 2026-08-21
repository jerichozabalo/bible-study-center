import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The design canvas: artboards authored by the canvas editor, plus its own
    // preview renderer. Reference material for the build, never built by it.
    "design/**",
    // Agent worktrees nest a whole second checkout under `.claude/worktrees/`,
    // and `design/**` above only matches the top-level path — so without this,
    // `npm run lint` goes red for anyone who has a worktree present, reporting
    // 37 errors in a copy of the logo-render scripts. Also covers the vendor
    // agent-skills the Neon integration installs; both are gitignored.
    ".claude/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
