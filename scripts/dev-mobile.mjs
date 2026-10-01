import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const webPort = Number(process.env.MOBILE_WEB_PORT ?? 3_200);
const serverPort = Number(process.env.MOBILE_SERVER_PORT ?? 3_201);

function findLanAddress() {
  if (process.env.MOBILE_HOST) return process.env.MOBILE_HOST;

  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal)
        return address.address;
    }
  }

  throw new Error(
    "No se encontró una dirección IPv4 local. Define MOBILE_HOST manualmente.",
  );
}

const host = findLanAddress();
const localWebUrl = `http://${host}:${webPort}`;
const localServerUrl = `http://${host}:${serverPort}`;
const webUrl = (process.env.PUBLIC_WEB_URL ?? localWebUrl).replace(/\/+$/, "");
const serverUrl = (
  process.env.PUBLIC_GAME_SERVER_URL ?? localServerUrl
).replace(/\/+$/, "");
const devAllowedOrigins = new Set([host, new URL(webUrl).hostname]);
const webOrigins = new Set([
  webUrl,
  localWebUrl,
  `http://localhost:${webPort}`,
]);
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

console.log(`\nSimon Says: ${webUrl}`);
if (!process.env.PUBLIC_WEB_URL) {
  console.log("El celular debe estar conectado a la misma red Wi-Fi.\n");
} else {
  console.log(`Socket.IO público: ${serverUrl}`);
  console.log("Comparte únicamente el enlace de Simon Says.\n");
}

const server = spawn(pnpmCommand, ["--filter", "@simon/server", "dev"], {
  env: {
    ...process.env,
    HOST: "0.0.0.0",
    PORT: String(serverPort),
    ROOM_STORE_FILE: "../../.data/mobile-rooms.json",
    WEB_ORIGINS: [...webOrigins].join(","),
  },
  stdio: "inherit",
});

const web = spawn(
  pnpmCommand,
  [
    "--filter",
    "@simon/web",
    "exec",
    "next",
    "dev",
    "--hostname",
    "0.0.0.0",
    "--port",
    String(webPort),
  ],
  {
    env: {
      ...process.env,
      DEV_ALLOWED_ORIGINS: [...devAllowedOrigins].join(","),
      NEXT_PUBLIC_GAME_SERVER_URL: serverUrl,
    },
    stdio: "inherit",
  },
);

const children = [server, web];
let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

for (const child of children) {
  child.once("error", (error) => {
    console.error(error.message);
    stop();
  });
}

const exitCode = await Promise.race(
  children.map(
    (child) =>
      new Promise((resolve) =>
        child.once("exit", (code) => resolve(code ?? 1)),
      ),
  ),
);

stop();
process.exitCode = Number(exitCode);
