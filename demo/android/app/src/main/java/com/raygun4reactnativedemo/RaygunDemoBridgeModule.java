package com.raygun4reactnativedemo;

import androidx.annotation.NonNull;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class RaygunDemoBridgeModule extends ReactContextBaseJavaModule {

    RaygunDemoBridgeModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "RaygunDemoBridge";
    }

    @ReactMethod
    public void runNativeError(){
        throw new Error("Example of a application breaking error outside of React Native");
    }
}
