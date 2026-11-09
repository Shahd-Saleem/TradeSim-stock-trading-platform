import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { databaseConfig } from "../src/lib/database-config.ts";

// Uses an isolated headless Chrome profile, a temporary registered account, and
// only deletes that exact account on exit. Never prints tokens or credentials.
config({ path: ".env.local", quiet: true });
const base = process.argv[2] || "http://localhost:3000";
const label = process.argv[3] || "current";
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error("Invalid artifact label");
const directory = resolve(".artifacts/layout", label);
await mkdir(directory, { recursive: true });
const chromePath = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
if (!chromePath) throw new Error("No Chrome or Edge browser found");
const port = 9300 + Math.floor(Math.random() * 500);
const browser = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${resolve(directory, "browser-profile")}`,
  ],
  { windowsHide: true, stdio: "ignore" },
);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const email = `layout-${randomBytes(12).toString("hex")}@example.test`;
let socket;
let owner;
let created = false;
const pending = new Map();
let nextId = 0;
const metrics = [];
let stage = "browser startup";
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Browser command timed out"));
    }, 15000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject,
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const value = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (value.exceptionDetails) throw new Error("Browser evaluation failed");
  return value.result.value;
}
async function ready(path) {
  await send("Page.navigate", { url: base + path });
  for (let i = 0; i < 80; i++) {
    if (
      await evaluate(
        `location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete' && !!document.querySelector('h1') && !document.querySelector('main[aria-busy="true"]') && !!document.querySelector('nav')`,
      )
    ) {
      await evaluate(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      );
      return;
    }
    await pause(100);
  }
  throw new Error("Page did not finish rendering");
}
try {
  let targets;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      targets = await (
        await fetch(`http://127.0.0.1:${port}/json/list`)
      ).json();
      if (targets.some((t) => t.type === "page")) break;
    } catch {}
    await pause(100);
  }
  const target = targets?.find((t) => t.type === "page");
  if (!target) throw new Error("Headless browser unavailable");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const promise = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) promise.reject(new Error("Browser command failed"));
      else promise.resolve(message.result);
    }
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  const origin = new URL(process.env.BETTER_AUTH_URL).origin;
  // Establish cleanup connectivity first, so test identities cannot be orphaned.
  stage = "cleanup connection";
  owner = new pg.Client(databaseConfig(process.env.DIRECT_URL));
  await owner.connect();
  stage = "temporary registration";
  const registration = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Layout Preview",
      email,
      password: randomBytes(24).toString("base64url"),
    }),
  });
  created = true;
  stage = `temporary registration HTTP ${registration.status}`;
  if (!registration.ok)
    throw new Error("Temporary account registration failed");
  stage = "browser session";
  for (const value of registration.headers.getSetCookie()) {
    const [nameValue, ...attributes] = value.split(";");
    const equals = nameValue.indexOf("=");
    if (!nameValue.includes("session_token")) continue;
    const cookie = await send("Network.setCookie", {
      name: nameValue.slice(0, equals),
      value: nameValue.slice(equals + 1),
      url: base,
      httpOnly: true,
      secure: base.startsWith("https:"),
      path: "/",
      sameSite: "Lax",
    });
    if (!cookie.success) throw new Error("Browser session setup failed");
    void attributes;
  }
  const sizes = [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ];
  for (const { width, height } of process.argv[4] === "--quick"
    ? sizes.slice(0, 1)
    : sizes) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    for (const path of process.argv[4] === "--quick"
      ? ["/markets"]
      : ["/dashboard", "/markets", "/portfolio", "/activity"]) {
      stage = `${width}x${height} ${path}`;
      await ready(path);
      if (path === "/markets") {
        for (let i = 0; i < 50; i++) {
          if (await evaluate(`!!document.querySelector('canvas')`)) break;
          await pause(100);
        }
      }
      const result = await evaluate(`(() => {
        const main = document.querySelector('main');
        const chart = document.querySelector('[aria-label*="simulated price chart"]');
        const stats = document.querySelector('[aria-label="Portfolio summary"]');
        const menu = document.querySelector('details');
        if (!menu) throw new Error('Authenticated profile missing');
        const chartRect = chart?.getBoundingClientRect();
        const canvases = chart ? [...chart.querySelectorAll('canvas')].filter(canvas => { const rect = canvas.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }) : [];
        const chartFits = !chart || (canvases.length > 0 && canvases.every(canvas => { const rect = canvas.getBoundingClientRect(); return rect.left >= chartRect.left - 1 && rect.right <= chartRect.right + 1 && rect.bottom <= chartRect.bottom + 1; }));
        return { width: innerWidth, clientWidth: document.documentElement.clientWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth, scale: visualViewport.scale, mainTop: Math.round(main.getBoundingClientRect().top), statsHeight: stats ? Math.round(stats.getBoundingClientRect().height) : null, chartHeight: chart ? Math.round(chart.getBoundingClientRect().height) : null, chartFits, chartBounds: chartRect?.toJSON(), canvasBounds: canvases.map(canvas => canvas.getBoundingClientRect().toJSON()), contentHeight: document.documentElement.scrollHeight, bodyFont: getComputedStyle(document.body).fontSize };
      })()`);
      result.path = path;
      if (!result.chartFits)
        console.log(
          "Chart geometry:",
          JSON.stringify({
            container: result.chartBounds,
            canvases: result.canvasBounds,
          }),
        );
      metrics.push(result);
      const screenshot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(
        resolve(directory, `${width}x${height}-${path.slice(1)}.png`),
        Buffer.from(screenshot.data, "base64"),
      );
      console.log(
        `${result.pageWidth <= result.clientWidth + 1 && result.scale === 1 && result.chartFits ? "PASS" : "FAIL"} ${width}x${height} ${path}: page ${result.pageWidth}px, KPI ${result.statsHeight ?? "-"}px, chart ${result.chartHeight ?? "-"}px`,
      );
      if (
        result.pageWidth > result.clientWidth + 1 ||
        result.scale !== 1 ||
        !result.chartFits
      )
        process.exitCode = 1;
    }
  }
  await writeFile(
    resolve(directory, "metrics.json"),
    JSON.stringify(metrics, null, 2),
  );
} catch {
  console.error(
    `Layout browser checks failed at ${stage}. No credentials or session values logged.`,
  );
  process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill();
  if (owner) {
    if (created)
      await owner.query('DELETE FROM tradesim."User" WHERE email = $1', [
        email,
      ]);
    await owner.end();
  }
}
