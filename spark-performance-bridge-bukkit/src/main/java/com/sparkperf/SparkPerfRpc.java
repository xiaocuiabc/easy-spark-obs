package com.sparkperf;

import com.springwater.easybot.bridge.api.BridgeEventHandler;
import com.springwater.easybot.bridge.api.IBridgeListener;
import com.springwater.easybot.bridge.api.events.lifecycle.BridgeOnlineAsyncEvent;
import com.springwater.easybot.bridge.api.rpc.BridgeRpc;
import com.springwater.easybot.bridge.api.rpc.IRpcListener;
import com.springwater.easybot.bridge.api.rpc.RpcContext;

/**
 * Bridge listener. {@code get_metrics} fills the RPC result object with the same
 * JSON schema the old mod produced, so the EasyBot JS plugin needs no data changes.
 */
public final class SparkPerfRpc implements IRpcListener, IBridgeListener {

    private final SparkPerformancePlugin plugin;

    public SparkPerfRpc(SparkPerformancePlugin plugin) {
        this.plugin = plugin;
    }

    @BridgeEventHandler
    public void onBridgeOnline(BridgeOnlineAsyncEvent event) {
        this.plugin.getLogger().info("[SparkPerf] EasyBot Bridge 已连接，性能查询 RPC 可用");
    }

    @BridgeRpc(
            method = "get_metrics",
            description = "获取服务器性能数据（TPS/MSPT/CPU/内存/磁盘）",
            displayName = "性能数据"
    )
    public void getMetrics(RpcContext context) {
        try {
            MetricsCollector.fill(context.getResult(), this.plugin.getServerVersion());
        } catch (Throwable t) {
            this.plugin.getLogger().warning("[SparkPerf] 采集性能数据失败: " + t);
            context.getResult().addProperty("ok", false);
            context.getResult().addProperty("error_message", t.getClass().getSimpleName() + ": " + t.getMessage());
        }
    }

    @BridgeRpc(
            method = "ping",
            description = "检测扩展是否在线",
            displayName = "在线检测"
    )
    public void ping(RpcContext context) {
        context.getResult().addProperty("pong", true);
        context.getResult().addProperty("version", this.plugin.getDescription().getVersion());
        context.getResult().addProperty("spark", this.plugin.isSparkApiPresent());
    }
}
