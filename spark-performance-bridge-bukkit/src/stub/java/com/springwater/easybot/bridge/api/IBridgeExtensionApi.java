package com.springwater.easybot.bridge.api;

import java.util.stream.Stream;

/**
 * Compile-only stub of EasyBot's bridge extension API.
 */
public interface IBridgeExtensionApi {

    void register(IBridgeExtension extension, IBridgeListener listener);

    void unregister(IBridgeListener listener);

    Stream<IBridgeExtension> getExtensions();

    static IBridgeExtensionApi getInstance() {
        throw new UnsupportedOperationException("compile-only stub");
    }
}
