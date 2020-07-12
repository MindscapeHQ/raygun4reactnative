package com.raygun.react;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.raygun.raygun4android.CrashReportingOnBeforeSend;
import com.raygun.raygun4android.RaygunClient;
import com.raygun.raygun4android.messages.crashreporting.RaygunBreadcrumbLevel;
import com.raygun.raygun4android.messages.crashreporting.RaygunBreadcrumbMessage;
import com.raygun.raygun4android.messages.crashreporting.RaygunErrorMessage;
import com.raygun.raygun4android.messages.crashreporting.RaygunMessage;
import com.raygun.raygun4android.messages.shared.RaygunUserInfo;
import com.raygun.raygun4android.services.CrashReportingPostService;

import android.util.DisplayMetrics;
import android.util.Log;
import android.os.Build;
import android.app.ActivityManager;
import android.view.WindowManager;

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Arguments;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.concurrent.ExecutionException;

public class Rg4rnModule extends ReactContextBaseJavaModule {

    private static ReactApplicationContext reactContext;
    private boolean initialized = false;

    public Rg4rnModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "Rg4rn";
    }

    @ReactMethod
    public void hasInitialized(Promise promise) {
        promise.resolve(initialized);
    }

    @ReactMethod
    private void hasReportingServiceRunning(Promise promise) {
        ActivityManager manager = (ActivityManager)reactContext.getSystemService(Context.ACTIVITY_SERVICE);
        for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
            if (CrashReportingPostService.class.getName().equals(service.service.getClassName())) {
                Log.i("Service already","running");
                promise.resolve(true);
                return;
            }
        }
        Log.i("Service not","running");
        promise.resolve(false);
    }

    @ReactMethod
    public void getEnvironmentInfo(Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putString("Architecture", Build.CPU_ABI);
        map.putString("DeviceName", Build.MODEL);
        map.putString("Brand", Build.BRAND);
        map.putString("Board", Build.BOARD);
        map.putString("DeviceCode", Build.DEVICE);
        try{
            String currentOrientation;
            int orientation = this.reactContext.getResources().getConfiguration().orientation;
            if (orientation == 1) {
                currentOrientation = "Portrait";
            } else if (orientation == 2) {
                currentOrientation = "Landscape";
            } else if (orientation == 3) {
                currentOrientation = "Square";
            } else {
                currentOrientation = "Undefined";
            }

            DisplayMetrics metrics = new DisplayMetrics();
            ((WindowManager) this.reactContext.getSystemService(Context.WINDOW_SERVICE)).getDefaultDisplay().getMetrics(metrics);

            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            ActivityManager am = (ActivityManager) this.reactContext.getSystemService(Context.ACTIVITY_SERVICE);
            am.getMemoryInfo(mi);
            map.putInt("ProcessorCount", Runtime.getRuntime().availableProcessors());
            map.putString("OSVersion", Build.VERSION.RELEASE);
            map.putString("OSSDKVersion", Integer.toString(Build.VERSION.SDK_INT));
            map.putInt("WindowsBoundWidth", metrics.widthPixels);
            map.putInt("WindowsBoundHeight", metrics.heightPixels);
            map.putString("CurrentOrientation", currentOrientation);
            map.putString("Locale", this.reactContext.getResources().getConfiguration().locale.toString());
            map.putDouble("AvailablePhysicalMemory", mi.availMem / 0x100000);
        }catch (Exception e) {
            Log.e("Environment", "Retireve Environment Info Error", e);
        }
        promise.resolve(map);
    }

    @ReactMethod
    public void init(ReadableMap options) {
        String apiKey = options.getString("apiKey");
        String version = options.getString("version");
        RaygunClient.init(this.reactContext, apiKey, version);
        Log.i("init", "version:" + version);
        initialized = true;
        RaygunClient.setOnBeforeSend(new OnBeforeSendHandler());
    }

    @ReactMethod
    public void sendCrashReport(String jsonPayload, String apiKey) {
        Log.i("sendCrashReport", "jsonPayload:\n" + jsonPayload);
        Intent intent = new Intent(RaygunClient.getApplicationContext(), CrashReportingPostService.class);
        intent.setAction("com.raygun.raygun4android.intent.action.LAUNCH_CRASHREPORTING_POST_SERVICE");
        intent.setPackage("com.raygun.raygun4android");
        intent.setComponent(new ComponentName(RaygunClient.getApplicationContext(), CrashReportingPostService.class));
        intent.putExtra("msg", jsonPayload);
        intent.putExtra("apikey", apiKey);

        CrashReportingPostService.enqueueWork(RaygunClient.getApplicationContext(), intent);
        Log.i("enqueue", "intent: "+ intent);
    }

    @ReactMethod
    public void setUser(ReadableMap userObj) {
        RaygunUserInfo user = new RaygunUserInfo(
                userObj.getString("identifier"),
                userObj.getString("firstName"),
                userObj.getString("fullName"),
                userObj.getString("email"));

        RaygunClient.setUser(user);
    }

    @ReactMethod
    public void setTags(ReadableArray tags) {
        RaygunClient.setTags(tags.toArrayList());
    }

    @ReactMethod
    public void setCustomData(ReadableMap customData) {
        RaygunClient.setCustomData(customData.toHashMap());
    }

    @ReactMethod
    public void recordBreadcrumb(ReadableMap breadcrumb) {
        String message = breadcrumb.getString("message");
        String category = breadcrumb.getString("category");
        ReadableMap customData = breadcrumb.getMap("customData");
        String level = breadcrumb.getString("level");
        RaygunBreadcrumbLevel breadcrumbLvl = level.equalsIgnoreCase("debug")
                ? RaygunBreadcrumbLevel.DEBUG
                : level.equalsIgnoreCase("info")
                    ? RaygunBreadcrumbLevel.INFO
                    : level.equalsIgnoreCase("warning")
                        ? RaygunBreadcrumbLevel.WARNING
                        : level.equalsIgnoreCase("error")
                            ? RaygunBreadcrumbLevel.ERROR
                            : RaygunBreadcrumbLevel.INFO;

        RaygunBreadcrumbMessage breadcrumbMessage = new RaygunBreadcrumbMessage
                .Builder(message)
                .category(category)
                .level(breadcrumbLvl)
                .customData(customData.toHashMap())
                .build();

        RaygunClient.recordBreadcrumb(breadcrumbMessage);
    }

    private class OnBeforeSendHandler implements CrashReportingOnBeforeSend {
        // Prevent the JS side error been process again as it propagate to the native side
        @Override
        public RaygunMessage onBeforeSend(RaygunMessage raygunMessage) {
            RaygunErrorMessage error = raygunMessage.getDetails().getError();
            if (error.getMessage().contains("JavascriptException")) {
                return null;
            }
            return raygunMessage;
        }
    }
}
