// 临时工具：用 mock bridge 完整走一遍 handlePerformanceRequest（含渲染）
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const pluginMain = path.resolve(__dirname, "..", "spark-performance-plugin", "main.js");
const code = fs.readFileSync(pluginMain, "utf8");

const sampleMetrics = {
    ok: true,
    source: "spark-api",
    spark: true,
    server: { version: "1.21.1", players: 2, max_players: 20, uptime_seconds: 90061 },
    tps: { "5s": 20.0, "10s": 19.92, "1m": 19.71, "5m": 19.05, "15m": 18.22 },
    mspt: {
        "10s": { min: 1.02, med: 1.48, p95: 2.21, max: 3.77 },
        "1m": { min: 1.10, med: 1.65, p95: 3.02, max: 5.4 },
        "5m": { min: 1.05, med: 1.58, p95: 2.95, max: 6.1 }
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

const bridge = {
    GetServerInfo: async function () {
        return { ServerName: "测试服", ServerVersion: "NeoForge 21.1 · 1.21.1" };
    },
    GetPlayerListAsync: async function () {
        return { List: [{ PlayerName: "a" }, { PlayerName: "b" }] };
    },
    RpcInvoke: async function (id, method, args) {
        if (id !== "bridge:spark_performance") {
            throw new Error("identifier mismatch: " + id);
        }
        if (method !== "get_metrics") {
            throw new Error("method mismatch: " + method);
        }
        return sampleMetrics;
    }
};

function loadPlugin(bridgeOverride) {
    const sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Promise: Promise,
        bus: { on: function () {} },
        logger: {
            info: function () {},
            warning: function () {},
            error: function () { console.error("[plugin error]", Array.prototype.slice.call(arguments).join(" ")); }
        },
        sessions: { GetBridges: function () { return [bridgeOverride]; } },
        puppeteer: { renderHtml: async function () { return "cGFzc2Vk"; } },
        MessageChain: class {
            Text(t) { return { kind: "text", text: t }; }
            Image(i) { return { kind: "image", image: i }; }
        },
        module: { exports: {} },
        exports: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(code + "\n;this.__expose = { handlePerformanceRequest: handlePerformanceRequest };", sandbox);
    return sandbox.__expose.handlePerformanceRequest;
}

async function runScenario(name, bridgeOverride) {
    const handler = loadPlugin(bridgeOverride);
    const replies = [];
    const event = {
        RawMessage: "性能",
        Context: { Reply: async function (msg) { replies.push(msg); } }
    };
    await handler(event);
    console.log("=== " + name + " ===");
    console.log("reply:", JSON.stringify(replies[0]).slice(0, 300));
}

(async function () {
    await runScenario("正常流程（图片回复）", bridge);
    await runScenario("RPC 失败（未安装扩展）", Object.assign({}, bridge, {
        RpcInvoke: async function () { throw new Error("扩展不存在: bridge:spark_performance"); }
    }));
    await runScenario("服务器离线", null);
})();
