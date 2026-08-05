# easy-spark-obs
纯ai无人工只有1.21.1 neoforge版本
在 QQ 群聊/私聊发送 `性能`，机器人返回一张渲染好的服务器性能图表图片。

## 组件

| 目录 | 说明 |
| --- | --- |
| `spark-performance-bridge/` | NeoForge 服务器端扩展 mod（Spark API 直连采集，RPC 输出） |
| `spark-performance-plugin/` | EasyBot 插件（触发 → RPC → puppeteer 渲染图片） |
| `spark-performance-plugin.zip` | 可直接安装到 EasyBot plugins/ 的插件包 |
| `spark_performance-1.0.0.jar` | 已编译好的 NeoForge mod（MC 1.21.1 / NeoForge 21.1.x），放入服务器 mods/ |
| `preview.png` | 图表效果预览 |
| `spark-tps-plugin/` | 旧方案（PAPI + 命令兜底），已被新方案取代，可忽略 |

## 安装（三步）

1. **服务器端**：服务器 `mods/` 安装 EasyBot（NeoForge 版）、Spark；
   把 `spark_performance-1.0.0.jar` 放入 `mods/`，重启服务器。
   （需要重新编译时，按 [spark-performance-bridge/README.md](spark-performance-bridge/README.md)
   执行 `.\gradlew.bat build`。）
2. **EasyBot 端**：把 `spark-performance-plugin.zip`（或整个文件夹）放入
   EasyBot `plugins/`，启用插件。
3. **发送 `性能`** 测试。确认 EasyBot 已安装渲染浏览器（推荐 ChromeHeadlessShell）。

## 设计说明

服务器是 NeoForge 1.21，两个限制决定了不能走老方案：

- 无 PlaceholderAPI（NeoForge 用不了 Bukkit 系 PAPI）；
- EasyBot 命令只返回第一行，`spark tps` 等多行输出拿不到数值。

方案走 EasyBot 官方支持的**服务器扩展（Bridge RPC）**：mod 用 Spark 的
Java API（`SparkProvider`）直连采集 TPS/MSPT/CPU，再加 JDK 采集内存/磁盘，
数据经 Bridge WebSocket 通道返回，不执行命令、不依赖 PAPI、**不使用 profiler**。

## 预览

![预览](preview.png)

（预览为示例数据渲染，实际值为服务器实时数据。）
