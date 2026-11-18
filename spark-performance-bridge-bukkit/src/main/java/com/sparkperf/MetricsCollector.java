package com.sparkperf;

import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.sun.management.OperatingSystemMXBean;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.bukkit.Bukkit;

/**
 * Collects the JSON schema consumed by the EasyBot JS plugin.
 *
 * <p>Spark statistics are read through {@link SparkMetrics} which is only linked
 * when this method reaches it; if Spark is not installed the resulting
 * {@link NoClassDefFoundError} is caught here and the base metrics are still
 * returned.</p>
 */
public final class MetricsCollector {

    private static final Logger LOGGER = Logger.getLogger("SparkPerformance");

    private MetricsCollector() {
    }

    public static void fill(JsonObject out, String serverVersion) {
        out.addProperty("ok", true);
        out.addProperty("source", "spark-api");
        out.add("server", collectServer(serverVersion));
        out.add("memory", collectMemory());
        out.add("disk", collectDisk());

        JsonObject tps = new JsonObject();
        JsonObject mspt = new JsonObject();
        JsonObject cpu = new JsonObject();
        boolean sparkLoaded = false;
        try {
            sparkLoaded = SparkMetrics.fill(tps, mspt, cpu);
        } catch (Throwable t) {
            // NoClassDefFoundError when Spark is absent, or a Spigot/Youer
            // remapping problem. Never fail the whole request for this.
            LOGGER.log(Level.FINE, "[SparkPerf] Spark API 不可用，仅返回基础指标", t);
        }

        out.addProperty("spark", sparkLoaded);
        out.add("tps", tps);
        out.add("mspt", mspt);
        out.add("cpu", cpu);
    }

    private static JsonObject collectServer(String serverVersion) {
        JsonObject server = new JsonObject();
        long uptimeSeconds = Math.max(0L, ManagementFactory.getRuntimeMXBean().getUptime() / 1000L);
        server.addProperty("uptime_seconds", uptimeSeconds);
        try {
            server.addProperty("players", Bukkit.getOnlinePlayers().size());
            server.addProperty("max_players", Bukkit.getMaxPlayers());
        } catch (Throwable t) {
            LOGGER.log(Level.FINE, "[SparkPerf] 获取在线玩家数失败", t);
        }
        if (serverVersion != null && !serverVersion.isBlank()) {
            server.addProperty("version", serverVersion);
        }
        return server;
    }

    private static JsonObject collectMemory() {
        JsonObject memory = new JsonObject();
        Runtime runtime = Runtime.getRuntime();
        long heapUsed = runtime.totalMemory() - runtime.freeMemory();
        long heapMax = runtime.maxMemory();
        JsonObject heap = new JsonObject();
        heap.addProperty("used", heapUsed);
        heap.addProperty("total", heapMax);
        heap.addProperty("percent", heapMax > 0L ? round2((double) heapUsed * 100.0 / (double) heapMax) : -1.0);
        memory.add("heap", heap);

        JsonObject system = new JsonObject();
        try {
            java.lang.management.OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            if (osBean instanceof OperatingSystemMXBean sunBean) {
                long total = sunBean.getTotalMemorySize();
                long free = sunBean.getFreeMemorySize();
                long used = Math.max(0L, total - free);
                system.addProperty("used", used);
                system.addProperty("total", total);
                system.addProperty("percent", total > 0L ? round2((double) used * 100.0 / (double) total) : -1.0);
            }
        } catch (Throwable t) {
            LOGGER.log(Level.FINE, "[SparkPerf] 获取系统内存失败", t);
        }
        memory.add("system", system);
        return memory;
    }

    private static JsonObject collectDisk() {
        JsonObject disk = new JsonObject();
        try {
            File dir = new File(".");
            long total = dir.getTotalSpace();
            long usable = dir.getUsableSpace();
            long used = Math.max(0L, total - usable);
            disk.addProperty("used", used);
            disk.addProperty("total", total);
            disk.addProperty("percent", total > 0L ? round2((double) used * 100.0 / (double) total) : -1.0);
        } catch (Throwable t) {
            LOGGER.log(Level.FINE, "[SparkPerf] 获取磁盘用量失败", t);
        }
        return disk;
    }

    static void put(JsonObject obj, String key, double value) {
        if (value < 0.0 || Double.isNaN(value) || Double.isInfinite(value)) {
            obj.add(key, JsonNull.INSTANCE);
        } else {
            obj.addProperty(key, round2(value));
        }
    }

    static void putMsptWindow(JsonObject out, String key, double min, double median, double p95, double max) {
        if (max < 0.0 || Double.isNaN(max) || Double.isInfinite(max)) {
            return;
        }
        JsonObject window = new JsonObject();
        window.addProperty("min", round2(min));
        window.addProperty("med", round2(median));
        window.addProperty("p95", round2(p95));
        window.addProperty("max", round2(max));
        out.add(key, window);
    }

    static double round2(double value) {
        return (double) Math.round(value * 100.0) / 100.0;
    }
}
