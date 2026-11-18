# SparkPerformanceBridge-Bukkit

服务器端 **Bukkit 插件**，把 Spark 的 TPS / MSPT / CPU / 内存 / 磁盘数据通过
EasyBot 插件版的 Bridge RPC 扩展提供给 EasyBot 主程序。

- 插件名：`SparkPerformance`
- 当前版本：**1.0.0**
- 构建产物：**`SparkPerformanceBridge-Bukkit-1.21.1-1.0.0.jar`**
- 目标端：**Paper / Youer 1.21.1（Java 21+）**
- 不再依赖 EasyBot 模组；EasyBot 以 **Bukkit 插件版**运行
- 支持 **模组版 Spark** 和 **Bukkit 插件版 Spark**（两者 API 相同，二选一）

## 原理

```
EasyBot 插件（Bukkit）
   └── Bridge RPC 扩展
          ▲
          │ IBridgeExtensionApi / IBridgeRpcManager
SparkPerformance 插件（Bukkit）
   └── SparkProvider（Spark API）
          ▲
          │ 类加载器
Spark（GAME layer 的模组版，或 plugins/ 的 Bukkit 插件版）
```

- **模组版 Spark**：Youer 的 `PluginClassLoader` 父加载器是
  `cpw.mods.modlauncher.TransformingClassLoader`，它持有 NeoForge GAME layer，
  `me.lucko.spark.api` 对插件可见。
- **Bukkit 插件版 Spark**：`plugin.yml` 里的 `softdepend: [spark]` 让 Spark 插件
  进入本插件的类加载器组。

Spark 的 Bukkit 插件版和模组版使用**同一套** `me.lucko.spark.api`
（`SparkProvider`、`Spark.tps()/mspt()/cpuProcess()/cpuSystem()`、
`StatisticWindow` 枚举都一样），所以 `SparkMetrics` 不需要为两种发行版分支。

EasyBot 的 API 以 `compileOnly` 引入（`src/stub/java` 是编译用的最小 stub），
运行时由 `plugins/EasyBot-2.4.0.jar` 提供。`plugin.yml` 声明 `depend: [EasyBot]`，
保证 EasyBot 先启用。

## 版本与支持范围

这是 **1.21.1 基线**的 Bukkit 插件，不是“Bukkit 全版本”插件：

- 编译目标：Paper API `1.21.1-R0.1-SNAPSHOT`、Java 21；
- `plugin.yml`：`api-version: '1.21'`；
- 目标 Spark：1.10.124（1.21.1）；
- 已实测：Youer 1.21.1（NeoForge 21.1.264）+ Spark 1.10.124（mod）+ EasyBot 2.4.0（插件）。

因此产物命名为 `SparkPerformanceBridge-Bukkit-1.21.1-1.0.0.jar`。同属 1.21.x 的
Paper/Youer 通常可用，但未逐个小版本验证；不支持 Java 8/17 的旧 Bukkit 服务端。

## 文件

```
spark-performance-bridge-bukkit/
├── build.gradle                 # version=1.0.0，产物名固定为 -Bukkit-1.21.1-1.0.0.jar
├── settings.gradle
├── gradlew / gradlew.bat        # Gradle Wrapper
├── src/main/java/com/sparkperf/
│   ├── SparkPerformancePlugin.java  # JavaPlugin 入口 + /sparkperf
│   ├── SparkPerfExtension.java      # Bridge 扩展描述（identifier/version）
│   ├── SparkPerfRpc.java            # @BridgeRpc get_metrics / ping
│   ├── MetricsCollector.java        # JSON schema + 基础指标
│   └── SparkMetrics.java            # Spark API 采集
├── src/main/resources/plugin.yml
└── src/stub/java/...                # EasyBot Bridge API 编译 stub（不打包）
```

## 构建

```bat
gradlew.bat build
```

产物：

```
build/libs/SparkPerformanceBridge-Bukkit-1.21.1-1.0.0.jar
```

需要 JDK 21+，首次构建会从 PaperMC 和 repo.lucko.me 拉取 `paper-api`、`spark-api`。
EasyBot 的 API stub 只参与编译，不会进入 jar。

## 命令

| 命令 | 权限 | 说明 |
| --- | --- | --- |
| `/sparkperf status` | `sparkperf.admin`（默认 OP） | 显示扩展 ID、版本、Spark API 是否可见 |
| `/sparkperf metrics` | `sparkperf.admin` | 打印一次完整指标 JSON，便于排查 |

正常使用时不需要手动执行命令，EasyBot 通过 RPC 调用 `get_metrics`。

## 部署

1. 服务器 `plugins/` 放入：
   - `EasyBot-2.4.0.jar`（或更新的插件版）
   - `SparkPerformanceBridge-Bukkit-1.21.1-1.0.0.jar`
2. 服务器安装 Spark（`mods/` 模组版或 `plugins/` Bukkit 插件版，二选一）。
3. 重启服务器，检查日志：
   ```
   [SparkPerf] 已检测到 Spark API（Bukkit 插件版 / 模组版使用同一套 API）
   [EasyBot] 扩展 [bridge:spark_performance] 注册了 2 个 RPC 接口
   [SparkPerf] 已注册 EasyBot Bridge 扩展 bridge:spark_performance（RPC: get_metrics / ping）
   ```

## 已验证

- 插件在 Youer 1.21.1 + Spark 1.10.124（mod）+ EasyBot 2.4.0（插件版）上正常启用；
- `/sparkperf metrics` 返回完整 TPS/MSPT/CPU/内存/磁盘；
- 模拟 EasyBot 主程序发送 `RPC_CALL`（`bridge:spark_performance` / `get_metrics`），
  收到 `error:false` 和完整 `result`；
- 插件禁用时正常注销 RPC / 事件监听。
