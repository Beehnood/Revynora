// Reports contain fixed check names and outcomes only, never inputs or headers.
export async function collectRegistration({
  status,
  contentType,
  readJson,
  cookies,
  profile,
  studentPage,
  https,
}) {
  const checks = {};
  async function check(name, operation) {
    try {
      checks[name] = (await operation()) ? "passed" : "failed";
    } catch {
      checks[name] = "error";
    }
  }
  await check("http201", () => status === 201);
  await check("jsonContentType", () =>
    /^application\/json(?:;|$)/i.test(contentType ?? ""),
  );
  await check("jsonBody", async () => {
    const data = await readJson();
    return (
      data !== null &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      !Object.hasOwn(data, "password") &&
      !Object.hasOwn(data, "passwordHash") &&
      !Object.hasOwn(data, "token")
    );
  });
  // Evaluate each attribute independently, even when JSON retrieval fails.
  const cookie = async () =>
    (await cookies()).find((item) => item.name === "revynora_session");
  await check("httpOnly", async () => (await cookie())?.httpOnly === true);
  await check(
    "secureOverHttps",
    async () => https === true && (await cookie())?.secure === true,
  );
  await check("sameSiteLax", async () => (await cookie())?.sameSite === "Lax");
  await check("cookiePath", async () => (await cookie())?.path === "/");
  await check("authenticatedSession", async () => {
    const result = await profile();
    return result.status === 200 && result.belongsToFixture === true;
  });
  await check("studentRole", async () => {
    const result = await profile();
    return result.status === 200 && result.role === "STUDENT";
  });
  await check("freePlan", async () => {
    const result = await profile();
    return result.status === 200 && result.plan === "FREE";
  });
  await check("studentPage", studentPage);
  return checks;
}
