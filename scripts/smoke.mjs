const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const serverUrl = process.env.SERVER_URL ?? "http://localhost:3001";

async function fetchWithTimeout(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) {
    throw new Error(`${url} respondió HTTP ${response.status}`);
  }
  return response;
}

const [webResponse, healthResponse, readyResponse] = await Promise.all([
  fetchWithTimeout(webUrl),
  fetchWithTimeout(`${serverUrl}/health`),
  fetchWithTimeout(`${serverUrl}/ready`),
]);

const [html, health, ready] = await Promise.all([
  webResponse.text(),
  healthResponse.json(),
  readyResponse.json(),
]);

if (!html.includes("SIMON SAYS")) {
  throw new Error("La web no contiene la identidad esperada de Simon Says");
}
if (health.status !== "ok" || ready.status !== "ready") {
  throw new Error(`API no saludable: ${JSON.stringify({ health, ready })}`);
}

console.log(
  JSON.stringify(
    {
      api: health.status,
      persistence: ready.persistence,
      ready: ready.status,
      web: "ok",
    },
    null,
    2,
  ),
);
