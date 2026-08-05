// 临时工具：用示例数据调用插件里的 buildDashboardHtml，输出 HTML 供 Edge 截图预览。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const pluginDir = path.resolve(__dirname, "..", "spark-performance-plugin");
const code = fs.readFileSync(path.join(pluginDir, "main.js"), "utf8");

const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise,
    bus: { on: function () {} },
    logger: { info: function () {}, warning: function () {}, error: function () {} },
    sessions: { GetBridges: function () { return []; } },
    puppeteer: { renderHtml: async function () { return ""; } },
    MessageChain: class {
        Text(t) { return { text: t }; }
        Image(i) { return { image: i }; }
    },
    module: { exports: {} },
    exports: {}
};
vm.createContext(sandbox);
vm.runInContext(code + "\n;this.__expose = { buildDashboardHtml: buildDashboardHtml, buildTextSummary: buildTextSummary };", sandbox);

const sampleMetrics = {
    ok: true,
    source: "spark-api",
    spark: true,
    server: {
        version: "1.21.1",
        players: 12,
        max_players: 20,
        uptime_seconds: 5 * 86400 + 3 * 3600 + 27 * 60
    },
    tps: { "5s": 20.0, "10s": 19.92, "1m": 19.71, "5m": 19.05, "15m": 18.22 },
    mspt: {
        "10s": { min: 1.02, med: 1.48, p95: 2.21, max: 3.77 },
        "1m": { min: 1.10, med: 1.65, p95: 3.02, max: 5.40 },
        "5m": { min: 1.05, med: 1.58, p95: 2.95, max: 6.10 }
    },
    cpu: {
        process: { "10s": 12.4, "1m": 11.2, "15m": 9.8 },
        system: { "10s": 41.5, "1m": 39.2, "15m": 33.6 }
    },
    memory: {
        heap: { used: 2147483648, total: 8589934592, percent: 25.0 },
        system: { used: 12094627905, total: 17179869184, percent: 70.4 }
    },
    disk: { used: 98784247808, total: 536870912000, percent: 18.4 }
};

const meta = {
    serverName: "我的服务器",
    serverVersion: "NeoForge 21.1 · 1.21.1",
    players: 12,
    maxPlayers: 20
};

const html = sandbox.__expose.buildDashboardHtml(sampleMetrics, meta);
const outHtml = path.resolve(__dirname, "preview.html");
fs.writeFileSync(outHtml, html, "utf8");
console.log("HTML written:", outHtml, "length:", html.length);
