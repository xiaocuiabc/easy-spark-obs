package com.sparkperf;

import com.springwater.easybot.bridge.api.IBridgeExtension;
import java.util.List;

/**
 * Bridge extension descriptor. The identifier must stay {@code bridge:spark_performance}
 * so the EasyBot JS plugin's {@code RpcInvoke("bridge:spark_performance", ...)} keeps working.
 */
public final class SparkPerfExtension implements IBridgeExtension {

    public static final String IDENTIFIER = "bridge:spark_performance";
    public static final String VERSION = "1.0.0";

    @Override
    public String getIdentifier() {
        return IDENTIFIER;
    }

    @Override
    public String getName() {
        return "Spark 性能扩展";
    }

    @Override
    public String getDescription() {
        return "通过 Spark API 直连采集 TPS / MSPT / CPU / 内存 / 磁盘数据，供 EasyBot 插件查询，不使用 profiler。";
    }

    @Override
    public String getAuthor() {
        return "abcxiaocui";
    }

    @Override
    public String getVersion() {
        return VERSION;
    }

    @Override
    public List<String> requiredPlugins() {
        return List.of();
    }
}
