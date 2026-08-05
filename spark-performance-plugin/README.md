# Spark 性能图表插件（EasyBot）

群聊或私聊发送 `性能`（或 `/性能`），机器人调用服务器上的 Spark 性能扩展，把
TPS / MSPT / CPU / 内存 / 磁盘渲染成一张仪表盘图片发回 QQ。

## 为什么这样实现

你的服务器是 **NeoForge 1.21**，存在两个限制：

- 没有 PlaceholderAPI（NeoForge 服务端无法使用 Bukkit 系 PlaceholderAPI）；
- EasyBot 执行命令时只返回第一行，`spark tps`、`/tps` 等多行输出拿不到数值。

因此本插件**不执行任何命令、不依赖 PlaceholderAPI**，而是走 EasyBot 的
**服务器扩展（Bridge RPC）**通道：

1. 服务器端安装 `spark-performance-bridge` mod（NeoForge），它注册为
   EasyBot Bridge 扩展 `bridge:spark_performance`；
2. 扩展内部通过 Spark 官方 Java API（`SparkProvider`）直连采集
   TPS（5s/10s/1m/5m/15m）、MSPT（10s/1m/5m）、CPU（进程/系统）；
   再通过 JDK 采集堆内存、系统内存与磁盘用量；
3. RPC 数据走 Bridge 自己的 WebSocket 通道，完全不受“命令只回第一行”影响；
4. 插件用 puppeteer 把指标渲染成 PNG 图片回复。

全程**不使用 spark profiler**。

## 安装

1. 服务器端：
   - 安装 [EasyBot NeoForge 版](https://docs.inectar.cn/)（Bridge ≥ 0.1.0-rc.4）；
   - 安装 [Spark](https://spark.lucko.me/)（NeoForge 版）；
   - 编译 `spark-performance-bridge` mod 并把生成的 jar 放入服务器 `mods/`；
   - 重启服务器。
2. 客户端（EasyBot 主程序）：
   - 把本文件夹（或 `spark-performance-plugin.zip`）放入 EasyBot 的 `plugins/` 目录；
   - 在 EasyBot 插件列表启用 `Spark 性能图表`；
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
| `EXTENSION_ID` | `bridge:spark_performance` | 必须与服务器 mod 的 `getIdentifier()` 一致 |
| `RPC_METHOD` | `get_metrics` | 服务器扩展的 RPC 方法名 |
| `TRIGGER_RE` | `/^\/?性能$/` | 触发词正则 |
| `RENDER_TIMEOUT_SECONDS` | `30` | 图片渲染超时（秒） |

多服务器时，插件默认取第一个在线的服务器。要指定服务器，把 `handlePerformanceRequest`
里的 `bridges[0]` 换成 `sessions.GetBridge("服务器TOKEN")`。

## 常见问题

- **提示“服务器性能扩展不可用”**：服务器 `mods/` 里没有安装
  `spark-performance-bridge`，或 EasyBot（NeoForge 版）版本过旧。重启服务器后再试。
- **图片发不出来**：确认 EasyBot 已安装渲染浏览器；也可以看插件日志中的
  “渲染性能图片失败”原因。
- **TPS 显示 `-`**：确认 Spark 已安装且正常加载；扩展在 Spark 缺失时会退化为
  只返回内存/磁盘等基础指标。
