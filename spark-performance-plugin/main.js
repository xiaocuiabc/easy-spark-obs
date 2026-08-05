/// <reference path="../easybot-sdk@0.3.2/easybot-sdk/easybot.d.ts" />

/**
 * Spark 性能图表插件
 *
 * 触发方式：群聊 / 私聊发送 性能（或 /性能）
 *
 * 数据链路：
 *   1. 服务器端安装 spark-performance-bridge mod（NeoForge），
 *      注册为 EasyBot Bridge 扩展 "bridge:spark_performance"。
 *   2. 本插件收到「性能」后，调用 bridge.RpcInvoke("bridge:spark_performance",
 *      "get_metrics", {})，RPC 走 EasyBot Bridge 自己的 WebSocket 通道，
 *      不经过命令输出，因此不受 EasyBot「命令只返回第一行」的 bug 影响；
 *      也不需要 PlaceholderAPI。
 *   3. 服务端扩展通过 Spark Java API（SparkProvider）直连采集
 *      TPS / MSPT / CPU，并用 JDK 采集内存与磁盘，不使用 profiler。
 *   4. 本插件用 puppeteer 把指标渲染成仪表盘图片发回 QQ。
 */

// ===== 配置 =====
// 服务器扩展标识，必须与 spark-performance-bridge mod 中 getIdentifier() 一致
const EXTENSION_ID = "bridge:spark_performance";
// 服务器扩展提供的 RPC 方法名
const RPC_METHOD = "get_metrics";
// 触发词：匹配 性能 / /性能
const TRIGGER_RE = /^\/?性能$/;
// 图片渲染超时（秒）
const RENDER_TIMEOUT_SECONDS = 30;
// =================

// 渲染串行队列：避免 puppeteer 并发渲染互相干扰
let renderQueue = Promise.resolve();

function isPerformanceCommand(rawMessage) {
    return TRIGGER_RE.test((rawMessage || "").trim());
}

function escapeHtml(text) {
    return String(text === null || text === undefined ? "" : text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** 把服务端可能返回的 null / -1 / NaN 统一归一化为 null */
function num(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const n = Number(value);
    if (Number.isNaN(n) || n < 0) {
        return null;
    }
    return n;
}

function fmt(value, suffix) {
    const n = num(value);
    if (n === null) {
        return "-";
    }
    const rounded = Math.round(n * 100) / 100;
    return String(rounded) + (suffix || "");
}

function tpsColor(value) {
    const n = num(value);
    if (n === null) {
        return "muted";
    }
    if (n >= 19.5) {
        return "good";
    }
    if (n >= 15) {
        return "warn";
    }
    return "bad";
}

function percentColor(pct) {
    if (pct < 70) {
        return "good";
    }
    if (pct < 90) {
        return "warn";
    }
    return "bad";
}

function formatBytes(bytes) {
    const n = num(bytes);
    if (n === null) {
        return "-";
    }
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = n;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return (value >= 100 ? Math.round(value) : Math.round(value * 10) / 10) + " " + units[unit];
}

function formatDuration(seconds) {
    const n = num(seconds);
    if (n === null) {
        return "-";
    }
    const total = Math.floor(n);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0) {
        return days + " 天 " + hours + " 小时";
    }
    if (hours > 0) {
        return hours + " 小时 " + minutes + " 分";
    }
    return minutes + " 分 " + (total % 60) + " 秒";
}

function nowText() {
    try {
        return new Date().toLocaleString("zh-CN", { hour12: false });
    } catch (err) {
        return new Date().toString();
    }
}

function usagePercent(usage) {
    const pct = num(usage && usage.percent);
    if (pct !== null) {
        return Math.max(0, Math.min(100, pct));
    }
    const used = num(usage && usage.used);
    const total = num(usage && usage.total);
    if (used !== null && total !== null && total > 0) {
        return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
    }
    return 0;
}

function formatUsage(usage) {
    const used = num(usage && usage.used);
    const total = num(usage && usage.total);
    if (used === null || total === null) {
        return "-";
    }
    return formatBytes(used) + " / " + formatBytes(total);
}

/** 构建仪表盘 HTML（无外部资源，可直接被 puppeteer 渲染） */
function buildDashboardHtml(metrics, meta) {
    const tps = metrics.tps || {};
    const mspt = metrics.mspt || {};
    const cpu = metrics.cpu || {};

    // TPS 五区间
    const tpsKeys = ["5s", "10s", "1m", "5m", "15m"];
    const tpsChips = tpsKeys
        .map(function (k) {
            const value = tps[k];
            return (
                '<div class="chip tps ' + tpsColor(value) + '">' +
                '<div class="chip-label">' + k + "</div>" +
                '<div class="chip-value">' + fmt(value) + "</div>" +
                "</div>"
            );
        })
        .join("");

    // MSPT 窗口
    const msptWindows = ["10s", "1m", "5m"];
    const msptCards = msptWindows
        .filter(function (k) {
            return mspt[k] && num(mspt[k].max) !== null;
        })
        .map(function (k) {
            const g = mspt[k];
            const label = k === "10s" ? "最近 10s" : k === "1m" ? "最近 1m" : "最近 5m";
            return (
                '<div class="tick-card">' +
                '<div class="tick-title">' + label + " · Tick 耗时 (ms)</div>" +
                '<div class="tick-grid">' +
                '<div class="tick-item"><span>最小</span><b>' + fmt(g.min) + "</b></div>" +
                '<div class="tick-item"><span>中位</span><b>' + fmt(g.med) + "</b></div>" +
                '<div class="tick-item"><span>95%ile</span><b>' + fmt(g.p95) + "</b></div>" +
                '<div class="tick-item"><span>最大</span><b>' + fmt(g.max) + "</b></div>" +
                "</div>" +
                "</div>"
            );
        })
        .join("");

    if (!msptCards) {
        msptCards =
            '<div class="tick-card">' +
            '<div class="tick-title">Tick 耗时 (MSPT)</div>' +
            '<div class="tick-grid"><div class="tick-item"><span>暂无数据</span><b>-</b></div></div>' +
            "</div>";
    }

    // CPU 三窗口
    const cpuWindows = ["10s", "1m", "15m"];
    function cpuList(cpuObj) {
        const values = cpuWindows.map(function (k) { return fmt(cpuObj && cpuObj[k], "%"); });
        return values.join(" · ");
    }

    // 内存 / 磁盘进度条
    function barRow(label, usage, subText) {
        const pct = usagePercent(usage);
        return (
            '<div class="bar-row">' +
            '<div class="bar-head"><span>' + label + "</span>" +
            '<span class="bar-percent">' + fmt(pct, "%") + "</span></div>" +
            '<div class="bar-track"><div class="bar-fill ' + percentColor(pct) +
            '" style="width:' + pct + '%"></div></div>' +
            '<div class="stat-sub" style="margin-top:6px">' + escapeHtml(subText) + "</div>" +
            "</div>"
        );
    }

    const server = metrics.server || {};
    const hasSpark = metrics.spark === true;

    return [
        "<!DOCTYPE html>",
        '<html lang="zh-CN">',
        "<head>",
        '<meta charset="utf-8" />',
        "<style>",
        "  * { box-sizing: border-box; }",
        "  body { margin: 0; background: #0b1020; }",
        "  .card { width: 840px; padding: 26px 30px; background: linear-gradient(160deg, #0f172a 0%, #0b1222 55%, #0d1526 100%); border: 1px solid #1f2b45; border-radius: 18px; font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', sans-serif; color: #e2e8f0; }",
        "  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #1f2b45; padding-bottom: 14px; }",
        "  .title { font-size: 22px; font-weight: 800; color: #fbbf24; letter-spacing: 1px; }",
        "  .sub { margin-top: 4px; font-size: 13px; color: #94a3b8; }",
        "  .time { font-size: 12px; color: #64748b; text-align: right; }",
        "  .section { margin-top: 20px; }",
        "  .section-label { margin-bottom: 10px; font-size: 12px; color: #94a3b8; letter-spacing: 2px; }",
        "  .meta-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }",
        "  .meta-card { padding: 12px 14px; background: #0b1222; border: 1px solid #1e293b; border-radius: 12px; }",
        "  .meta-label { font-size: 12px; color: #94a3b8; }",
        "  .meta-value { margin-top: 4px; font-family: Consolas, Menlo, monospace; font-size: 16px; font-weight: 700; color: #e2e8f0; }",
        "  .chips { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }",
        "  .chip { padding: 12px 8px; background: #0b1222; border: 1px solid #1e293b; border-radius: 12px; text-align: center; }",
        "  .chip-label { font-size: 12px; color: #94a3b8; }",
        "  .chip-value { margin-top: 4px; font-family: Consolas, Menlo, monospace; font-size: 20px; font-weight: 700; }",
        "  .chip.good .chip-value { color: #4ade80; }",
        "  .chip.warn .chip-value { color: #fbbf24; }",
        "  .chip.bad .chip-value { color: #f87171; }",
        "  .chip.muted .chip-value { color: #475569; }",
        "  .tick-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }",
        "  .tick-card { padding: 12px 14px; background: #0b1222; border: 1px solid #1e293b; border-radius: 12px; }",
        "  .tick-title { margin-bottom: 8px; font-size: 12px; color: #94a3b8; }",
        "  .tick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center; }",
        "  .tick-item span { display: block; font-size: 11px; color: #64748b; }",
        "  .tick-item b { font-family: Consolas, Menlo, monospace; font-size: 16px; color: #7dd3fc; }",
        "  .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }",
        "  .stat-card { padding: 12px 14px; background: #0b1222; border: 1px solid #1e293b; border-radius: 12px; }",
        "  .stat-label { font-size: 12px; color: #94a3b8; }",
        "  .stat-value { margin-top: 4px; font-family: Consolas, Menlo, monospace; font-size: 18px; font-weight: 700; color: #e2e8f0; }",
        "  .stat-sub { margin-top: 5px; font-size: 11px; color: #64748b; line-height: 1.5; }",
        "  .bar-row { margin-top: 10px; padding: 12px 14px; background: #0b1222; border: 1px solid #1e293b; border-radius: 12px; }",
        "  .bar-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; }",
        "  .bar-head .bar-percent { font-family: Consolas, Menlo, monospace; font-size: 15px; font-weight: 700; }",
        "  .bar-track { margin-top: 8px; height: 8px; background: #1e293b; border-radius: 999px; overflow: hidden; }",
        "  .bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #22d3ee, #4ade80); }",
        "  .bar-fill.warn { background: linear-gradient(90deg, #fbbf24, #f97316); }",
        "  .bar-fill.bad { background: linear-gradient(90deg, #f87171, #ef4444); }",
        "  .bar-fill.muted { background: #334155; }",
        "  .notice { margin-bottom: 10px; padding: 10px 12px; background: #3b1d1d; border: 1px solid #7f1d1d; border-radius: 10px; font-size: 12px; color: #fca5a5; }",
        "  .footer { margin-top: 16px; font-size: 11px; color: #475569; text-align: center; }",
        "</style>",
        "</head>",
        "<body>",
        '  <div class="card">',
        '    <div class="header">',
        '      <div><div class="title">⚡ 服务器性能</div><div class="sub">' + escapeHtml(meta.serverName) +
        (meta.serverVersion ? " · " + escapeHtml(meta.serverVersion) : "") + "</div></div>",
        '      <div class="time">' + escapeHtml(nowText()) + "</div>",
        "    </div>",
        '    <div class="section"><div class="meta-row">' +
        '      <div class="meta-card"><div class="meta-label">在线玩家</div><div class="meta-value">' +
        (meta.players !== null ? meta.players + (meta.maxPlayers !== null ? " / " + meta.maxPlayers : "") : "-") +
        "</div></div>" +
        '      <div class="meta-card"><div class="meta-label">运行时长</div><div class="meta-value">' +
        formatDuration(server.uptime_seconds) + "</div></div>" +
        '      <div class="meta-card"><div class="meta-label">数据源</div><div class="meta-value" style="font-size:13px">' +
        (hasSpark ? "Spark API 直连" : "JDK 基础指标") + "</div></div>" +
        "    </div></div>",
        '    <div class="section"><div class="section-label">TPS（最近 5s / 10s / 1m / 5m / 15m）</div><div class="chips">' + tpsChips + "</div></div>",
        '    <div class="section"><div class="section-label">Tick 耗时（MSPT）</div><div class="tick-row">' + msptCards + "</div></div>",
        '    <div class="section"><div class="section-label">CPU 使用率（10s / 1m / 15m）</div><div class="row3">' +
        '      <div class="stat-card"><div class="stat-label">CPU 进程</div><div class="stat-value">' + fmt((cpu.process || {})["1m"], "%") + '</div><div class="stat-sub">' + cpuList(cpu.process) + "</div></div>" +
        '      <div class="stat-card"><div class="stat-label">CPU 系统</div><div class="stat-value">' + fmt((cpu.system || {})["1m"], "%") + '</div><div class="stat-sub">' + cpuList(cpu.system) + "</div></div>" +
        '      <div class="stat-card"><div class="stat-label">Tick 耗时</div><div class="stat-value">' + fmt(mspt["1m"] && mspt["1m"].med, "ms") + '</div><div class="stat-sub">1 分钟中位数</div></div>' +
        "    </div></div>",
        '    <div class="section"><div class="section-label">内存</div>' +
        barRow("堆内存（JVM）", metrics.memory && metrics.memory.heap, formatUsage(metrics.memory && metrics.memory.heap)) +
        barRow("系统内存", metrics.memory && metrics.memory.system, formatUsage(metrics.memory && metrics.memory.system)) +
        "    </div>",
        '    <div class="section"><div class="section-label">磁盘</div>' +
        barRow("服务器目录所在盘", metrics.disk, formatUsage(metrics.disk)) +
        "    </div>",
        (hasSpark ? "" :
            '    <div class="section"><div class="notice">未获取到 Spark 数据：请确认服务器已安装 Spark 插件，且 spark-performance-bridge mod 能加载。当前仅显示内存 / 磁盘 / 服务器基础信息。</div></div>'),
        '    <div class="footer">数据来源：Spark API 直连（EasyBot Bridge RPC）· 未使用 profiler</div>',
        "  </div>",
        "</body>",
        "</html>"
    ].join("\n");
}

/** 纯文本兜底摘要（渲染不可用或失败时使用） */
function buildTextSummary(metrics, meta) {
    const tps = metrics.tps || {};
    const mspt = metrics.mspt || {};
    const cpu = metrics.cpu || {};
    const parts = [];
    const tpsValues = ["5s", "10s", "1m", "5m", "15m"].map(function (k) {
        return fmt(tps[k]);
    });
    if (tpsValues.some(function (v) { return v !== "-"; })) {
        parts.push("TPS(5s/10s/1m/5m/15m): " + tpsValues.join(", "));
    }
    if (mspt["1m"] && num(mspt["1m"].med) !== null) {
        parts.push("MSPT(1m 中位/95%ile): " + fmt(mspt["1m"].med, "ms") + " / " + fmt(mspt["1m"].p95, "ms"));
    }
    if (cpu.process && num(cpu.process["1m"]) !== null) {
        parts.push("CPU 进程(10s/1m/15m): " + cpuListForText(cpu.process));
    }
    if (cpu.system && num(cpu.system["1m"]) !== null) {
        parts.push("CPU 系统(10s/1m/15m): " + cpuListForText(cpu.system));
    }
    if (metrics.memory && metrics.memory.heap) {
        parts.push("堆内存: " + formatUsage(metrics.memory.heap));
    }
    if (metrics.disk) {
        parts.push("磁盘: " + formatUsage(metrics.disk));
    }
    const header = meta.serverName + (meta.serverVersion ? " · " + meta.serverVersion : "") + "\n";
    return parts.length ? header + parts.join("\n") : header + "服务器没有返回可解析的性能数据。";

    function cpuListForText(cpuObj) {
        return ["10s", "1m", "15m"].map(function (k) { return fmt(cpuObj[k], "%"); }).join(" · ");
    }
}

/** 把 HTML 渲染成图片，返回 base64 字符串（不含 data: 前缀） */
function renderToImage(html) {
    const task = renderQueue.then(function () {
        return puppeteer.renderHtml(html, RENDER_TIMEOUT_SECONDS, null, null);
    });
    // 某个任务失败不能卡死后续渲染
    renderQueue = task.catch(function () {});
    return task;
}

async function handlePerformanceRequest(event) {
    try {
        const bridges = sessions.GetBridges();
        const bridge = bridges && bridges.length > 0 ? bridges[0] : null;

        if (!bridge) {
            await event.Context.Reply(
                new MessageChain().Text("服务器未在线，暂时无法查询性能。")
            );
            return;
        }

        // 服务器基础信息（名称 / 版本 / 在线玩家）由 Bridge 提供
        let serverName = "Minecraft 服务器";
        let serverVersion = "";
        try {
            const info = await bridge.GetServerInfo();
            if (info) {
                if (info.ServerName) {
                    serverName = info.ServerName;
                }
                if (info.ServerVersion) {
                    serverVersion = info.ServerVersion;
                }
            }
        } catch (err) {
            logger.warning("获取服务器信息失败: {0}", String((err && err.message) || err));
        }

        let playerCount = null;
        let maxPlayers = null;
        try {
            const listInfo = await bridge.GetPlayerListAsync();
            const list = listInfo && (listInfo.List || listInfo.players);
            playerCount = list ? list.length : 0;
        } catch (err) {
            logger.warning("获取在线玩家列表失败: {0}", String((err && err.message) || err));
        }

        // 调用服务器端 Spark 性能扩展
        let metrics;
        try {
            metrics = await bridge.RpcInvoke(EXTENSION_ID, RPC_METHOD, {});
        } catch (err) {
            const msg = String((err && err.message) || err);
            await event.Context.Reply(
                new MessageChain().Text(
                    "服务器性能扩展不可用：\n" + msg +
                    "\n\n请确认服务器 mods 目录已安装 spark-performance-bridge mod，且 EasyBot（NeoForge 版）Bridge ≥ 0.1.0-rc.4。"
                )
            );
            return;
        }

        if (!metrics || metrics.ok === false) {
            const errMsg = metrics && metrics.error_message ? String(metrics.error_message) : "服务器未返回数据";
            await event.Context.Reply(
                new MessageChain().Text("服务器性能数据采集失败：" + errMsg)
            );
            return;
        }

        // 服务器端扩展也可能返回玩家数/上限（旧版扩展没有时用 Bridge 数据兜底）
        const server = metrics.server || {};
        if (num(server.players) !== null) {
            playerCount = num(server.players);
        }
        if (num(server.max_players) !== null) {
            maxPlayers = num(server.max_players);
        }
        if (server.version && !serverVersion) {
            serverVersion = String(server.version);
        }

        const meta = {
            serverName: serverName,
            serverVersion: serverVersion,
            players: playerCount,
            maxPlayers: maxPlayers
        };

        if (typeof puppeteer === "undefined" || !puppeteer.renderHtml) {
            await event.Context.Reply(
                new MessageChain().Text(buildTextSummary(metrics, meta))
            );
            return;
        }

        try {
            const html = buildDashboardHtml(metrics, meta);
            const base64 = await renderToImage(html);
            await event.Context.Reply(
                new MessageChain().Image("data:image/png;base64," + base64)
            );
        } catch (err) {
            logger.error("渲染性能图片失败: {0}", String((err && err.message) || err));
            // 渲染失败时退回文本，保证功能可用
            await event.Context.Reply(
                new MessageChain().Text(
                    buildTextSummary(metrics, meta) + "\n\n（图片渲染失败，已退回文本）"
                )
            );
        }
    } catch (err) {
        logger.error("处理性能查询请求时发生错误: {0}", String((err && err.stack) || err));
    }
}

bus.on("enable", () => {
    logger.info("Spark 性能图表插件已启用（扩展: {0}）", EXTENSION_ID);
});

bus.on("disable", () => {
    logger.info("Spark 性能图表插件已禁用");
});

bus.on("group_message_event", (event) => {
    if (isPerformanceCommand(event.RawMessage)) {
        return handlePerformanceRequest(event);
    }
});

bus.on("direct_message_event", (event) => {
    if (isPerformanceCommand(event.RawMessage)) {
        return handlePerformanceRequest(event);
    }
});
