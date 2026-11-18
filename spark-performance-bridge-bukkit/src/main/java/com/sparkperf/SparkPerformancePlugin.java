package com.sparkperf;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.springwater.easybot.bridge.api.IBridgeExtensionApi;
import com.springwater.easybot.bridge.api.rpc.IBridgeRpcManager;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Server-side Bukkit plugin that exposes Spark statistics to the EasyBot plugin
 * through EasyBot's Bridge RPC extension API.
 *
 * <p>This is the plugin replacement for the old NeoForge bridge mod. It does not
 * depend on the EasyBot mod: the EasyBot Bukkit plugin provides the bridge API
 * and the WebSocket connection to the EasyBot main program.</p>
 *
 * <p>Spark can be installed either as a Bukkit plugin or as a NeoForge mod;
 * both ship the same {@code me.lucko.spark.api} and the same {@code SparkProvider}
 * entry point, so the collection code is identical. With the Bukkit Spark plugin,
 * {@code softdepend: [spark]} puts the Spark plugin class loader into this
 * plugin's class loader group. With modded Spark on Youer, the plugin class
 * loader's parent is Youer's transforming class loader, which sees all mod
 * classes in the GAME layer. The Spark API is compile-only and is never bundled
 * in this jar.</p>
 */
public final class SparkPerformancePlugin extends JavaPlugin {

    public static final String EXTENSION_ID = "bridge:spark_performance";

    private static final Pattern MC_VERSION_PATTERN = Pattern.compile("\\(MC: ([^)]+)\\)");

    private SparkPerfExtension extension;
    private SparkPerfRpc rpc;
    private String serverVersion = "";
    private boolean sparkApiPresent;

    @Override
    public void onEnable() {
        this.serverVersion = detectMinecraftVersion();

        // This performs a real class load through the plugin class loader (parent:
        // Youer's TransformingClassLoader -> GAME layer modules, which include all
        // mods). It gives an early, actionable log line when Spark is missing.
        try {
            Class.forName("me.lucko.spark.api.SparkProvider", false, getClass().getClassLoader());
            this.sparkApiPresent = true;
            getLogger().info("[SparkPerf] 已检测到 Spark API（Bukkit 插件版 / 模组版使用同一套 API）");
        } catch (Throwable t) {
            this.sparkApiPresent = false;
            getLogger().warning("[SparkPerf] 未检测到 Spark API，将只返回内存/磁盘/服务器基础指标: " + t);
        }

        this.extension = new SparkPerfExtension();
        this.rpc = new SparkPerfRpc(this);

        try {
            // Event listener registration (optional, used for the bridge-online log).
            IBridgeExtensionApi.getInstance().register(this.extension, this.rpc);
            // RPC registration: this is what makes get_metrics / ping callable.
            IBridgeRpcManager.getInstance().registerRpc(this.extension, this.rpc);
            getLogger().info("[SparkPerf] 已注册 EasyBot Bridge 扩展 " + EXTENSION_ID
                    + "（RPC: get_metrics / ping）");
        } catch (Throwable t) {
            getLogger().severe("[SparkPerf] 注册 EasyBot Bridge 扩展失败，请确认 EasyBot 插件已启用: " + t);
            getLogger().severe("[SparkPerf] 堆栈: " + stackTrace(t));
        }
    }

    @Override
    public void onDisable() {
        try {
            if (this.extension != null) {
                IBridgeRpcManager.getInstance().unregisterRpc(this.extension);
                if (this.rpc != null) {
                    IBridgeExtensionApi.getInstance().unregister(this.rpc);
                }
            }
            getLogger().info("[SparkPerf] 已注销 EasyBot Bridge 扩展 " + EXTENSION_ID);
        } catch (Throwable t) {
            getLogger().warning("[SparkPerf] 注销 EasyBot Bridge 扩展时发生异常: " + t);
        }
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!command.getName().equalsIgnoreCase("sparkperf")) {
            return false;
        }
        if (!sender.hasPermission("sparkperf.admin")) {
            sender.sendMessage("[SparkPerf] 你没有权限使用该命令。");
            return true;
        }

        String sub = args.length == 0 ? "status" : args[0].toLowerCase(Locale.ROOT);
        switch (sub) {
            case "status" -> {
                sender.sendMessage("[SparkPerf] extension=" + EXTENSION_ID
                        + " version=" + getDescription().getVersion()
                        + " sparkApi=" + this.sparkApiPresent
                        + " serverVersion=" + this.serverVersion);
            }
            case "metrics" -> {
                JsonObject result = new JsonObject();
                try {
                    MetricsCollector.fill(result, this.serverVersion);
                } catch (Throwable t) {
                    result.addProperty("ok", false);
                    result.addProperty("error_message", t.getClass().getSimpleName() + ": " + t.getMessage());
                }
                Gson gson = new GsonBuilder().setPrettyPrinting().create();
                sender.sendMessage(gson.toJson(result));
            }
            default -> sender.sendMessage("[SparkPerf] 用法: /" + label + " <status|metrics>");
        }
        return true;
    }

    /**
     * Returns the Minecraft version string, falling back to parsing the Bukkit
     * version string when the server does not implement Paper's convenience method.
     */
    private static String detectMinecraftVersion() {
        try {
            String version = Bukkit.getServer().getMinecraftVersion();
            if (version != null && !version.isBlank()) {
                return version;
            }
        } catch (Throwable ignored) {
            // Not a Paper-derived server; use the version string below.
        }
        try {
            String bukkitVersion = Bukkit.getVersion();
            Matcher matcher = MC_VERSION_PATTERN.matcher(bukkitVersion == null ? "" : bukkitVersion);
            if (matcher.find()) {
                return matcher.group(1);
            }
        } catch (Throwable ignored) {
            // Fall through to the generic version string.
        }
        try {
            return Bukkit.getVersion();
        } catch (Throwable ignored) {
            return "";
        }
    }

    public String getServerVersion() {
        return this.serverVersion;
    }

    public boolean isSparkApiPresent() {
        return this.sparkApiPresent;
    }

    private static String stackTrace(Throwable t) {
        StringBuilder sb = new StringBuilder();
        for (StackTraceElement element : t.getStackTrace()) {
            sb.append(System.lineSeparator()).append("    at ").append(element);
        }
        Throwable cause = t.getCause();
        if (cause != null && cause != t) {
            sb.append(System.lineSeparator()).append("  caused by: ").append(cause);
            for (StackTraceElement element : cause.getStackTrace()) {
                sb.append(System.lineSeparator()).append("    at ").append(element);
            }
        }
        return sb.toString();
    }
}
