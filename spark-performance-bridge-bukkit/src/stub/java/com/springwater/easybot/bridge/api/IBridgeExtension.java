package com.springwater.easybot.bridge.api;

/**
 * Compile-only stub of EasyBot's bridge extension API.
 *
 * <p>The real interface is provided by the EasyBot plugin at runtime. Keep this
 * in sync with EasyBot-2.4.0's {@code com.springwater.easybot.bridge.api.IBridgeExtension}.</p>
 */
public interface IBridgeExtension {

    String getIdentifier();

    String getName();

    String getDescription();

    String getAuthor();

    String getVersion();

    java.util.List<String> requiredPlugins();
}
