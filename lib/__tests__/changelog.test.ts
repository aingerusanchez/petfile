import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHANGELOG } from "../changelog.generated";

/**
 * The generated module is what the app ships; the Markdown is what people
 * read and edit. This is the only thing stopping the two from disagreeing,
 * and a changelog that disagrees with the build is worse than none — it is
 * the one screen whose whole job is saying what you are holding.
 */
describe("the shipped changelog", () => {
  it("matches CHANGELOG.md", () => {
    const source = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
    expect(CHANGELOG).toBe(source);
  });

  it("names the version this build carries", () => {
    const { version } = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );
    expect(CHANGELOG).toContain(`## [v${version}]`);
  });
});
