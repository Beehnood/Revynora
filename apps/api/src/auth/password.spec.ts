import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";
describe("Mots de passe", () => {
  it("sale et vérifie sans stocker le mot de passe", async () => {
    const first = await hashPassword("UnePhraseLongue!42");
    const second = await hashPassword("UnePhraseLongue!42");
    expect(first).not.toBe(second);
    expect(first).not.toContain("UnePhrase");
    expect(await verifyPassword("UnePhraseLongue!42", first)).toBe(true);
    expect(await verifyPassword("incorrect", first)).toBe(false);
    expect(await verifyPassword("incorrect", "broken")).toBe(false);
  });
});
