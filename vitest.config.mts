import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node, not jsdom — these are server-boundary tests (PRD "Testing
    // Decisions"). A screen test that needs a DOM opts in with a
    // `@vitest-environment jsdom` docblock of its own.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    // One file at a time. The test database is a Neon branch reached over the
    // network, and a branch that autosuspends answers the first connection of
    // a burst with `fetch failed` — parallel files turn that into a flake on
    // whichever file happened to be first.
    fileParallelism: false,
    // Neon autosuspend: a cold branch takes seconds to wake, and the retry in
    // `lib/db.ts` sits through it. Vitest's default five seconds is shorter
    // than a normal cold start.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
