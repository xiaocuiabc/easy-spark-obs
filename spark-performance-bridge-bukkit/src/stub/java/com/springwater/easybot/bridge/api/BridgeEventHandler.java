package com.springwater.easybot.bridge.api;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Compile-only stub of EasyBot's bridge event handler annotation.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface BridgeEventHandler {

    BridgeHandlerPriority priority() default BridgeHandlerPriority.NORMAL;
}
