import assert from "node:assert/strict";
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const health = await fetch("http://127.0.0.1:3001/api/v1/health");
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok", version: "0.0.0" });
    const ready = await fetch("http://127.0.0.1:3001/api/v1/health/ready");
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: "ready" });
    console.log("HTTP liveness et readiness : OK");
    break;
  } catch (error) {
    if (attempt === 29) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
