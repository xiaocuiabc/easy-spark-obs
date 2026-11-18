package com.springwater.easybot.bridge.api.rpc;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Compile-only stub of EasyBot's RPC method annotation.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface BridgeRpc {

    String method();

    String description() default "";

    String displayName() default "";
}
