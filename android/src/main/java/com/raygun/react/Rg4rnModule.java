package com.raygun.react;

import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.raygun.raygun4android.CrashReportingOnBeforeSend;
import com.raygun.raygun4android.RaygunClient;
import com.raygun.raygun4android.messages.crashreporting.RaygunBreadcrumbLevel;
import com.raygun.raygun4android.messages.crashreporting.RaygunBreadcrumbMessage;
import com.raygun.raygun4android.messages.crashreporting.RaygunErrorMessage;
import com.raygun.raygun4android.messages.crashreporting.RaygunMessage;
import com.raygun.raygun4android.messages.shared.RaygunUserInfo;
import com.raygun.raygun4android.services.CrashReportingPostService;

import android.content.SharedPreferences;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.os.Build;
import android.app.ActivityManager;
import android.view.WindowManager;

import androidx.annotation.RequiresApi;

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Arguments;
import com.raygun.raygun4android.services.RUMPostService;

import org.json.JSONArray;
import org.json.JSONObject;

import static android.provider.Settings.Secure.getString;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import javax.annotation.Nullable;

public class Rg4rnModule extends ReactContextBaseJavaModule implements LifecycleEventListener {

    private static ReactApplicationContext reactContext;
    private boolean initialized = false;
    private long startedTime;

    private static final String ON_RESUME = "ON_RESUME";
    private static final String ON_PAUSE = "ON_PAUSE";
    private static final String ON_DESTROY = "ON_DESTROY";
    private static final String ON_START = "ON_START";
    private static final String DEVICE_ID = "DEVICE_ID";
    private static final String STORAGE_KEY = "__RAYGUN_CRASH_REPORT__";

    public Rg4rnModule(ReactApplicationContext context, long startedAt) {
        super(context);
        reactContext = context;
        startedTime = startedAt;
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
    private void attachActivityMonitor(Promise promise) {
        ActivityManager manager = (ActivityManager)reactContext.getSystemService(Context.ACTIVITY_SERVICE);
        for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
            if (RUMPostService.class.getName().equals(service.service.getClassName())) {
                Log.i("RUMPostService","is running");
                promise.resolve(true);
                return;
            }
        }
        Log.i("RUMPostService","is not running");
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
            Log.e("Environment", "Retrieve Environment Info Error", e);
        }
        promise.resolve(map);
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put(ON_DESTROY, ON_DESTROY);
        constants.put(ON_PAUSE, ON_PAUSE);
        constants.put(ON_RESUME, ON_RESUME);
        constants.put(ON_START, ON_START);
        constants.put(DEVICE_ID, getUniqueIdSync());
        constants.put("osVersion", Build.VERSION.RELEASE);
        constants.put("platform", Build.MODEL);
        return constants;
    }

    @SuppressLint("HardwareIds")
    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getUniqueIdSync() {
        return getString(getReactApplicationContext().getContentResolver(), Settings.Secure.ANDROID_ID);
    }

    @ReactMethod
    public void init(ReadableMap options) {
        Log.i("init", options.toString());
        if (initialized) {
            Log.i("init", "Already initialized");
            return;
        }
        String apiKey = options.getString("apiKey");
        String version = options.getString("version");
        String customCREndpoint = options.getString("customCrashReportingEndpoint");
        Boolean enableRUM = options.getBoolean("enableRUM");
        RaygunClient.init(this.reactContext, apiKey, version);
        initialized = true;

        RaygunClient.setOnBeforeSend(new OnBeforeSendHandler());
        Log.i("customEndpoint", customCREndpoint);
        RaygunClient.setCustomCrashReportingEndpoint(customCREndpoint);

        if (enableRUM) {
            reactContext.addLifecycleEventListener(this);
            long ms = SystemClock.uptimeMillis() - startedTime;
            WritableMap payload = Arguments.createMap();
            payload.putString("name", getActivityName());
            payload.putInt("duration", (int) ms);
            sendJSEvent(ON_START, payload);
        }
    }

    private String getActivityName() {
        return reactContext.getCurrentActivity().getClass().getSimpleName();
    }

    private void sendJSEvent(String eventType, @Nullable WritableMap payload) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventType, payload);
    }

    @Override
    public void onHostResume() {
        WritableMap payload = Arguments.createMap();
        payload.putString("name", getActivityName());
        this.sendJSEvent(ON_RESUME, payload);
    }

    @Override
    public void onHostPause() {
        WritableMap payload = Arguments.createMap();
        payload.putString("name", getActivityName());
        this.sendJSEvent(ON_PAUSE, payload);
    }

    @Override
    public void onHostDestroy() {
        WritableMap payload = Arguments.createMap();
        payload.putString("name", getActivityName());
        this.sendJSEvent(ON_DESTROY, payload);
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
    public void clearSession(String userId) {
        RaygunClient.clearBreadcrumbs();
        RaygunClient.setCustomData(new HashMap());
        RaygunClient.setUser("");
        RaygunClient.setTags(new ArrayList());
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

    @ReactMethod
    public void loadCrashReports(Promise promise) {
        SharedPreferences preferences = reactContext.getSharedPreferences(STORAGE_KEY, Context.MODE_PRIVATE);
        String reportsJson = preferences.getString("reports", "[]");
        promise.resolve(reportsJson);
    }

    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @ReactMethod
    public void saveCrashReport(String report, Promise promise) {
        Log.d("Save Report", report);
        SharedPreferences preferences = reactContext.getSharedPreferences(STORAGE_KEY, Context.MODE_PRIVATE);
        String reportsJson = preferences.getString("reports", "[]");
        try {
            JSONArray reports = new JSONArray(reportsJson);
            if (reports.length() >= 10) {
                reports.remove(0);
            }
            reports.put(new JSONObject(report));
            preferences.edit().putString("reports", reports.toString()).commit();
            promise.resolve(null);
        } catch (Exception e) {
            Log.e("Save Report Error", e.getMessage());
            promise.reject(e);
        }
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
