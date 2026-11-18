# Spark 性能图表插件（EasyBot）

群聊或私聊发送 `性能`（或 `/性能`），机器人调用服务器上的 Spark 性能扩展，把
TPS / MSPT / CPU / 内存 / 磁盘渲染成一张仪表盘图片发回 QQ。

## 适用环境

- 服务端：**Paper / Youer 1.21.1**
- Spark：**模组版** 或 **Bukkit 插件版**（二选一，API 相同）
- EasyBot：**插件版**（`plugins/EasyBot-2.4.0.jar` 或更新）
- 服务器端还需要本项目的 `SparkPerformanceBridge-Bukkit-1.21.1-1.0.0.jar`（`plugins/`）

不再需要 EasyBot 模组，也不再需要旧的 `spark-performance-bridge` mod。

## 为什么这样实现

以前有两个限制：

- NeoForge 端没有 PlaceholderAPI（Bukkit 系 PAPI 用不了）；
- EasyBot 执行命令时只返回第一行，`spark tps` 等多行输出拿不到数值。

因此本插件**不执行任何命令、不依赖 PlaceholderAPI**，而是走 EasyBot 的
**服务器扩展（Bridge RPC）**通道：

1. 服务器端 `plugins/` 安装 `SparkPerformanceBridge-Bukkit-1.21.1-1.0.0.jar`，
   它注册为 EasyBot Bridge 扩展 `bridge:spark_performance`；
2. 该插件通过 Spark 官方 Java API（`SparkProvider`）直连采集
   TPS（5s/10s/1m/5m/15m）、MSPT（10s/1m/5m）、CPU（进程/系统）；
   再通过 JDK / Bukkit 采集堆内存、系统内存、磁盘与在线人数；
3. RPC 数据走 Bridge 自己的 WebSocket 通道，完全不受“命令只回第一行”影响；
4. 插件用 puppeteer 把指标渲染成 PNG 图片回复。

Spark 的模组版和 Bukkit 插件版使用同一套 `me.lucko.spark.api`：模组版由 Youer 的
GAME layer 对 Bukkit 插件可见，Bukkit 插件版由 `softdepend: [spark]` 提供类可见性。
全程**不使用 spark profiler**。

## 安装

1. **服务器端**：
   - `mods/` 放模组版 Spark，或 `plugins/` 放 Bukkit 插件版 Spark（二选一）；
   - `plugins/` 放入 EasyBot 插件版（≥ 2.4.0）和
     `SparkPerformanceBridge-Bukkit-1.21.1-1.0.0.jar`；
   - 重启服务器，确认日志里出现：
     `[EasyBot] 扩展 [bridge:spark_performance] 注册了 2 个 RPC 接口`。
2. **EasyBot 主程序**：
   - 把本文件夹（或 `spark-performance-plugin.zip` 解压出的文件夹）放入 EasyBot 的
     `plugins/` 目录，保持 `main.js` / `manifest.json` / `preview.png` 在同一层；
   - 在 EasyBot 插件列表启用「Spark 性能图表」；
   - 确保 EasyBot 安装了渲染浏览器（推荐 ChromeHeadlessShell），否则自动退回纯文本。

## 使用

群聊 / 私聊发送：

```
性能
```

或

```
/性能
```

## 配置

编辑 `main.js` 顶部：

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `EXTENSION_ID` | `bridge:spark_performance` | 必须与服务器插件中 `getIdentifier()` 一致 |
| `RPC_METHOD` | `get_metrics` | 服务器扩展的 RPC 方法名 |
| `TRIGGER_RE` | `/^\/?性能$/` | 触发词正则 |
| `RENDER_TIMEOUT_SECONDS` | `30` | 图片渲染超时（秒） |

多服务器时，插件默认取第一个在线的服务器。要指定服务器，把 `handlePerformanceRequest`
里的 `bridges[0]` 换成 `sessions.GetBridge("服务器TOKEN")`。

## 常见问题

- **提示“服务器性能扩展不可用”**：确认服务器 `plugins/` 里有
  `SparkPerformanceBridge-Bukkit-1.21.1-1.0.0.jar`，并且 `plugins/` 里的 EasyBot 是
  **插件版**（不是 mod）。重启服务器后再试。
- **图片发不出来**：确认 EasyBot 已安装渲染浏览器；也可以看插件日志中的
  “渲染性能图片失败”原因。
- **TPS 显示 `-`**：确认 Spark 已安装且正常加载；插件在 Spark 缺失时会退化为
  只返回内存/磁盘等基础指标。
- **服务器端排查**：控制台执行 `/sparkperf status`（Spark API 是否可见）和
  `/sparkperf metrics`（打印完整 JSON）。
