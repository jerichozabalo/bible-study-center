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
  ]),
]);

export default eslintConfig;
