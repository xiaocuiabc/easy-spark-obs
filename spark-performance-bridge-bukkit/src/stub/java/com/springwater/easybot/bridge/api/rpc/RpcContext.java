package com.springwater.easybot.bridge.api.rpc;

import com.google.gson.JsonObject;

/**
 * Compile-only stub of EasyBot's RPC context.
 *
 * <p>Only the result/body/error accessors are needed by this plugin. The real
 * class (provided by EasyBot at runtime) has the same public signatures.</p>
 */
public class RpcContext {

    public JsonObject getBody() {
        throw new UnsupportedOperationException("compile-only stub");
    }

    public JsonObject getResult() {
        throw new UnsupportedOperationException("compile-only stub");
    }

    public JsonObject getError() {
        throw new UnsupportedOperationException("compile-only stub");
    }
}
