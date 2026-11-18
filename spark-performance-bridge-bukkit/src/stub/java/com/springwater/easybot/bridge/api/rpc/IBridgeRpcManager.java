package com.springwater.easybot.bridge.api.rpc;

import java.util.HashMap;
import java.util.List;

/**
 * Compile-only stub of EasyBot's bridge RPC manager.
 */
public interface IBridgeRpcManager {

    void registerRpc(com.springwater.easybot.bridge.api.IBridgeExtension extension, IRpcListener listener);

    void unregisterRpc(com.springwater.easybot.bridge.api.IBridgeExtension extension);

    HashMap<com.springwater.easybot.bridge.api.IBridgeExtension, List<IRpcListener>> getRpcListeners();

    static IBridgeRpcManager getInstance() {
        throw new UnsupportedOperationException("compile-only stub");
    }
}
