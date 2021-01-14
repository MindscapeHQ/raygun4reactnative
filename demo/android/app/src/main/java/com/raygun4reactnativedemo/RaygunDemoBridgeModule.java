package com.raygun4reactnativedemo;

import androidx.annotation.NonNull;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class RaygunDemoBridgeModule extends ReactContextBaseJavaModule {


    ExecutorService es = Executors.newFixedThreadPool(2);

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
        // Make an alternative thread to throw the error.
        AlternativeThread at = new AlternativeThread();
        // Activate the worker
        es.execute(at);
        // Shut down the service
        es.shutdown();
    }

    static class AlternativeThread implements Runnable {
        @Override
        public void run() {
            throw new RuntimeException("Test Error: Native Error");
        }
    }
}
