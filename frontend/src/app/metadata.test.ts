import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("social preview metadata", () => {
  it("uses the production PNG asset instead of the SVG", () => {
    const root = process.cwd();
    const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain('url: "/social-preview.png"');
    expect(layout).not.toContain('images: ["/social-preview.svg"]');
    expect(existsSync(join(root, "public/social-preview.png"))).toBe(true);
  });
});
