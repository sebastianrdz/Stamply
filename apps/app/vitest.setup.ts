import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * `server-only` throws unconditionally when its default export is resolved
 * (see node_modules/server-only/index.js) — it only no-ops under the
 * "react-server" export condition that webpack's RSC bundler sets. Vitest
 * runs under plain Node/Vite, so every module in src/lib that starts with
 * `import "server-only"` would throw on import unless we neutralize it here.
 */
vi.mock("server-only", () => ({}));
