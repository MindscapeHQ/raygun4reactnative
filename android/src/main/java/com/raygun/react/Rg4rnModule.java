package com.raygun.react;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import com.facebook.react.bridge.ReadableMap;

public class Rg4rnModule extends ReactContextBaseJavaModule {

    private static ReactApplicationContext reactContext;

    public Rg4rnModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "Rg4rn";
    }

    @ReactMethod
    public void init(ReadableMap options) {
        String apiKey = options.getString("apiKey");
        String version = options.getString("version");
        //TODO: init the backend entry point we choice, could be RaygunClient, CrashReporint, or the CrashReportingPostService;
    }
}
