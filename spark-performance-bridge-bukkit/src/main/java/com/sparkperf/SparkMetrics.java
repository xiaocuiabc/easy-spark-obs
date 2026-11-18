package com.sparkperf;

import com.google.gson.JsonObject;
import java.util.logging.Level;
import java.util.logging.Logger;
import me.lucko.spark.api.Spark;
import me.lucko.spark.api.SparkProvider;
import me.lucko.spark.api.statistic.StatisticWindow;
import me.lucko.spark.api.statistic.misc.DoubleAverageInfo;
import me.lucko.spark.api.statistic.types.DoubleStatistic;
import me.lucko.spark.api.statistic.types.GenericStatistic;

/**
 * Spark API access. This class deliberately references Spark API types in its
 * signatures, so it is only loaded on demand (see {@link MetricsCollector}):
 * if Spark is missing, the plugin degrades to base metrics instead of failing.
 *
 * <p>Spark is installed as a NeoForge mod. On Youer the Bukkit plugin class
 * loader delegates to the transforming class loader that owns the GAME layer,
 * so these are the same API classes and the same {@code SparkProvider.instance}
 * that Spark's own mod initialized.</p>
 */
final class SparkMetrics {

    private static final Logger LOGGER = Logger.getLogger("SparkPerformance");

    private SparkMetrics() {
    }

    static boolean fill(JsonObject tps, JsonObject mspt, JsonObject cpu) {
        Spark spark = SparkProvider.get();

        try {
            collectTps(spark, tps);
        } catch (Throwable t) {
            LOGGER.log(Level.FINE, "[SparkPerf] 采集 TPS 失败", t);
        }
        try {
            collectMspt(spark, mspt);
        } catch (Throwable t) {
            LOGGER.log(Level.FINE, "[SparkPerf] 采集 MSPT 失败", t);
        }
        try {
            collectCpu(spark, cpu);
        } catch (Throwable t) {
            LOGGER.log(Level.FINE, "[SparkPerf] 采集 CPU 失败", t);
        }
        return true;
    }

    private static void collectTps(Spark spark, JsonObject out) {
        DoubleStatistic<StatisticWindow.TicksPerSecond> statistic = spark.tps();
        if (statistic == null) {
            return;
        }
        MetricsCollector.put(out, "5s", statistic.poll(StatisticWindow.TicksPerSecond.SECONDS_5));
        MetricsCollector.put(out, "10s", statistic.poll(StatisticWindow.TicksPerSecond.SECONDS_10));
        MetricsCollector.put(out, "1m", statistic.poll(StatisticWindow.TicksPerSecond.MINUTES_1));
        MetricsCollector.put(out, "5m", statistic.poll(StatisticWindow.TicksPerSecond.MINUTES_5));
        MetricsCollector.put(out, "15m", statistic.poll(StatisticWindow.TicksPerSecond.MINUTES_15));
    }

    private static void collectMspt(Spark spark, JsonObject out) {
        GenericStatistic<DoubleAverageInfo, StatisticWindow.MillisPerTick> statistic = spark.mspt();
        if (statistic == null) {
            return;
        }
        putMsptWindow(out, "10s", statistic, StatisticWindow.MillisPerTick.SECONDS_10);
        putMsptWindow(out, "1m", statistic, StatisticWindow.MillisPerTick.MINUTES_1);
        putMsptWindow(out, "5m", statistic, StatisticWindow.MillisPerTick.MINUTES_5);
    }

    private static void putMsptWindow(
            JsonObject out,
            String key,
            GenericStatistic<DoubleAverageInfo, StatisticWindow.MillisPerTick> statistic,
            StatisticWindow.MillisPerTick window
    ) {
        try {
            DoubleAverageInfo info = statistic.poll(window);
            if (info == null) {
                return;
            }
            double max = info.max();
            if (max < 0.0 || Double.isNaN(max) || Double.isInfinite(max)) {
                return;
            }
            MetricsCollector.putMsptWindow(
                    out,
                    key,
                    info.min(),
                    info.median(),
                    info.percentile95th(),
                    max
            );
        } catch (Throwable t) {
            LOGGER.log(Level.FINE, "[SparkPerf] 采集 MSPT 窗口 " + key + " 失败", t);
        }
    }

    private static void collectCpu(Spark spark, JsonObject out) {
        JsonObject process = new JsonObject();
        JsonObject system = new JsonObject();
        DoubleStatistic<StatisticWindow.CpuUsage> processStatistic = spark.cpuProcess();
        DoubleStatistic<StatisticWindow.CpuUsage> systemStatistic = spark.cpuSystem();
        if (processStatistic != null) {
            MetricsCollector.put(process, "10s", processStatistic.poll(StatisticWindow.CpuUsage.SECONDS_10));
            MetricsCollector.put(process, "1m", processStatistic.poll(StatisticWindow.CpuUsage.MINUTES_1));
            MetricsCollector.put(process, "15m", processStatistic.poll(StatisticWindow.CpuUsage.MINUTES_15));
        }
        if (systemStatistic != null) {
            MetricsCollector.put(system, "10s", systemStatistic.poll(StatisticWindow.CpuUsage.SECONDS_10));
            MetricsCollector.put(system, "1m", systemStatistic.poll(StatisticWindow.CpuUsage.MINUTES_1));
            MetricsCollector.put(system, "15m", systemStatistic.poll(StatisticWindow.CpuUsage.MINUTES_15));
        }
        out.add("process", process);
        out.add("system", system);
    }
}
