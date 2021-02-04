package com.raygun.react;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.Application;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.WindowManager;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.raygun.raygun4android.CrashReportingOnBeforeSend;
import com.raygun.raygun4android.RaygunClient;
import com.raygun.raygun4android.messages.crashreporting.RaygunBreadcrumbLevel;
import com.raygun.raygun4android.messages.crashreporting.RaygunBreadcrumbMessage;
import com.raygun.raygun4android.messages.crashreporting.RaygunErrorMessage;
import com.raygun.raygun4android.messages.crashreporting.RaygunMessage;
import com.raygun.raygun4android.messages.shared.RaygunUserInfo;

import org.jetbrains.annotations.NotNull;

import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;

import javax.annotation.Nullable;

import timber.log.Timber;

import static android.provider.Settings.Secure.getString;

public class RaygunNativeBridgeModule extends ReactContextBaseJavaModule implements Application.ActivityLifecycleCallbacks {

    //#region---GLOBAL CONSTANTS----------------------------------------------------------------------

    // ReactNative Context, a connection the the React Code.
    private static ReactApplicationContext reactContext;

    // Are the NativeBridge features initialized
    private boolean realUserMonitoringInitialized = false;
    private boolean crashReportingInitialized = false;

    //The activity in the foreground of the application that the user is currently interacting with.
    private static WeakReference<Activity> currentActivity;

    // Session state change events
    public static final String ON_SESSION_RESUME = "ON_SESSION_RESUME";
    public static final String ON_SESSION_PAUSE = "ON_SESSION_PAUSE";
    public static final String ON_SESSION_END = "ON_SESSION_END";

    //Activity state change events
    public static final String ON_VIEW_LOADING = "ON_VIEW_LOADING";
    public static final String ON_VIEW_LOADED = "ON_VIEW_LOADED";

    private static final String DEVICE_ID = "DEVICE_ID";

    //#endregion--------------------------------------------------------------------------------------

    //#region---CONSTRUCTION METHODS------------------------------------------------------------------

    /**
     * Constructor for the RaygunNativeBridgeModule class that links ReactNative to Java and stores
     * the start time to monitor the applications startup time.
     *
     * @param context   - ReactApplicationContext, parsed to the RaygunNativeBridgePackage's
     *                  createNativeModules method. An instance that links Java and ReactNative in a
     *                  wrapper.
     * @param startedAt - Long, time when the application started.
     * @see RaygunNativeBridgePackage
     */
    public RaygunNativeBridgeModule(ReactApplicationContext context, long startedAt) {
        super(context);
        reactContext = context;
    }

    /**
     * Returns a string that will be used to identify this bridge in ReactNative with the code: const
     * { stringReturnedByThisMethod } = NativeModules;
     *
     * @return - String value that will identify this bridge module.
     */
    @Override
    public @NotNull String getName() {
        return "RaygunNativeBridge";
    }

    /**
     * Initialize the Bridge (and the Raygun4Android client by proxy) with the same options given to
     * the Raygun4ReactNative client init method.
     */
    @ReactMethod
    public void initCrashReportingNativeSupport(String apiKey, String version, String customCrashReportingEndpoint) {
        if (crashReportingInitialized) {
            Timber.i("ReactNativeBridge crash reporting already initialized");
            return;
        }

        RaygunClient.init(reactContext, apiKey, version);
        RaygunClient.enableCrashReporting();
        RaygunClient.setOnBeforeSend(new OnBeforeSendHandler());
        RaygunClient.setCustomCrashReportingEndpoint(customCrashReportingEndpoint);

        crashReportingInitialized = true;
    }

    /**
     * This method is used by the RealUserMonitor to instantiate the LifecycleEventListeners. This is
     * not included with the 'init' method, as the RealUserMonitor needs this code to be run
     * independently. However, if RUM is not enabled, then this would provide some unnecessary
     * performance downgrades, hence why it is only instantiated if RUM is enabled.
     */
    @ReactMethod
    public void initRealUserMonitoringNativeSupport() {
        //Cant initialise bridge rum twice
        if (realUserMonitoringInitialized) return;

        if (reactContext.getCurrentActivity() != null) {
            //Store the current activity to differentiate session changes
            currentActivity = new WeakReference<>(reactContext.getCurrentActivity());
            //Attach the activity listening logic to the Application
            reactContext.getCurrentActivity().getApplication().registerActivityLifecycleCallbacks(this);
        } else Log.e("TAG", "This react application has no active activity");

        realUserMonitoringInitialized = true;
    }

    /**
     * This class is designed to implement CrashReportingOnBeforeSend interface from the
     * Raygun4Android SDK. Before Sending some CrashReport, this handler will ensure that the crash
     * didn't occur in the ReactNative space, else the ReactNative provider will have picked up on
     * that (else we will have two of the same CrashReport going through).
     */
    private static class OnBeforeSendHandler implements CrashReportingOnBeforeSend {

        // Prevent the JS side error from being processed again as it propagate to the native side
        @Override
        public RaygunMessage onBeforeSend(RaygunMessage raygunMessage) {
            RaygunErrorMessage error = raygunMessage.getDetails().getError();
            if (error.getMessage().contains("JavascriptException")) {
                return null;
            }
            return raygunMessage;
        }
    }

    //#endregion--------------------------------------------------------------------------------------

    //#region---Life Cycle Methods -----------------------------------------------------------------

    @Override
    public void onActivityCreated(Activity activity, Bundle bundle) {
        //If there is no current activity then this one will become the current activity
        if (currentActivity == null) {
            currentActivity = new WeakReference<>(activity);
        }

        //Pass off a view loading event to the react side
        WritableMap payload = Arguments.createMap();
        payload.putString("viewname", activity.getClass().getSimpleName());
        payload.putString("time", System.currentTimeMillis() + "");
        this.sendJSEvent(ON_VIEW_LOADING, payload);
    }

    @Override
    public void onActivityStarted(Activity activity) {
        WritableMap payload = Arguments.createMap();
        long time = System.currentTimeMillis();
        payload.putString("viewname", activity.getClass().getSimpleName());
        payload.putString("time", time + "");
        this.sendJSEvent(ON_VIEW_LOADED, payload);
    }

    @Override
    public void onActivityResumed(Activity activity) {
        //If the activity that recently paused is returning to the foreground then the whole
        // application has resumed, therefore update the session
        if (currentActivity.get() == activity) this.sendJSEvent(ON_SESSION_RESUME, null);

            //If any other activity resumes that means that it is taking over from the current activity
        else currentActivity = new WeakReference<>(activity);
    }

    @Override
    public void onActivityPaused(Activity activity) {
        //If the current activity is pausing then the session is paused
        if (currentActivity.get() == activity) this.sendJSEvent(ON_SESSION_PAUSE, null);
    }

    @Override
    public void onActivityStopped(Activity activity) {
    }

    @Override
    public void onActivitySaveInstanceState(Activity activity, Bundle bundle) {
    }

    @Override
    public void onActivityDestroyed(Activity activity) {
        if (currentActivity.get() == activity) {
            this.sendJSEvent(ON_SESSION_END, null);
            currentActivity = null;
        }
    }

    /**
     * Emits an event to the ReactContext.
     *
     * @param eventType - Should be one of the KEY values, START, RESUME, PAUSE, DESTROY.
     * @param payload   - A WritableMap of information to be parsed with this event's occurence.
     */
    private void sendJSEvent(String eventType, @Nullable WritableMap payload) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventType, payload);
    }

    //#endregion--------------------------------------------------------------------------------------

    //#region---INFORMATION GATHERING METHODS---------------------------------------------------------

    /**
     * Collects all the environment information about this device and returns it to the promise in the
     * form of a WritableMap.
     *
     * @param promise - Resolves with a WriteableMap of all the information about the system.
     */
    @ReactMethod
    public void getEnvironmentInfo(Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putString("Architecture", Build.CPU_ABI);
        map.putString("DeviceName", Build.MODEL);
        map.putString("Brand", Build.BRAND);
        map.putString("Board", Build.BOARD);
        map.putString("DeviceCode", Build.DEVICE);
        try {
            String currentOrientation;
            int orientation = reactContext.getResources().getConfiguration().orientation;
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
            ((WindowManager) reactContext.getSystemService(Context.WINDOW_SERVICE))
                    .getDefaultDisplay().getMetrics(metrics);

            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            ActivityManager am = (ActivityManager) reactContext
                    .getSystemService(Context.ACTIVITY_SERVICE);
            am.getMemoryInfo(mi);
            map.putInt("ProcessorCount", Runtime.getRuntime().availableProcessors());
            map.putString("OSVersion", Build.VERSION.RELEASE);
            map.putString("OSSDKVersion", Integer.toString(Build.VERSION.SDK_INT));
            map.putInt("WindowsBoundWidth", metrics.widthPixels);
            map.putInt("WindowsBoundHeight", metrics.heightPixels);
            map.putString("CurrentOrientation", currentOrientation);
            map
                    .putString("Locale", reactContext.getResources().getConfiguration().locale.toString());
            map.putDouble("AvailablePhysicalMemory", mi.availMem / 0x100000);
        } catch (Exception e) {
            Timber.e(e, "Retrieve Environment Info Error");
        }
        promise.resolve(map);
    }

    /**
     * Collects the constant values used in this SDK. Such as the OS_Version, and Platform. Along with
     * key values for events that can occur with RUM enabled.
     *
     * @return - A map of constant objects and a key value to access them.
     */
    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put(ON_SESSION_END, ON_SESSION_END);
        constants.put(ON_SESSION_PAUSE, ON_SESSION_PAUSE);
        constants.put(ON_SESSION_RESUME, ON_SESSION_RESUME);
        constants.put(ON_VIEW_LOADING, ON_VIEW_LOADING);
        constants.put(ON_VIEW_LOADED, ON_VIEW_LOADED);
        constants.put(DEVICE_ID, getUniqueIdSync());
        constants.put("osVersion", Build.VERSION.RELEASE);
        constants.put("platform", Build.MODEL);
        return constants;
    }

    /**
     * Gets the Device ID. This method is synchronous as the returning value needs to be immediately
     * available.
     *
     * @return - String, value of the device id.
     */
    @SuppressLint("HardwareIds")
    @ReactMethod(isBlockingSynchronousMethod = true)
    public String getUniqueIdSync() {
        return getString(getReactApplicationContext().getContentResolver(), Settings.Secure.ANDROID_ID);
    }

    //#endregion--------------------------------------------------------------------------------------


    //#region---UPDATE NATIVE TO MATCH REACT METHODS--------------------------------------------------

    /**
     * Set the User in the Raygun4Android SDK to ensure all reports are consistent between the SDKs.
     *
     * @param userObj - ReadableMap that is represented by the 'User' type.
     */
    @ReactMethod
    public void setUser(ReadableMap userObj) {
        RaygunUserInfo user = new RaygunUserInfo(
                userObj.getString("identifier"),
                userObj.getString("firstName"),
                userObj.getString("fullName"),
                userObj.getString("email"));

        RaygunClient.setUser(user);
    }

    /**
     * Sets the tags in the Raygun4Android SDK to ensure all reports are consistent between the SDKs.
     *
     * @param tags - A ReadableArray of strings.
     */
    @ReactMethod
    public void setTags(ReadableArray tags) {
        RaygunClient.setTags(tags.toArrayList());
    }

    /**
     * Set the CustomData in the Raygun4Android SDK to ensure all reports are consistent between
     * SDKs.
     *
     * @param customData - ReadableMap that is represented by the 'CustomData' type.
     */
    @ReactMethod
    public void setCustomData(ReadableMap customData) {
        RaygunClient.setCustomData(customData.toHashMap());
    }

    /**
     * Set the Breadcrumb in the Raygun4Android SDK to ensure all reports are consistent between
     * SDKs.
     *
     * @param breadcrumb - ReadableMap that is represented by the 'Breadcrumb' type.
     */
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

    /**
     * Clear the breadcrumbs.
     */
    @ReactMethod
    public void clearBreadcrumbs() {
        RaygunClient.clearBreadcrumbs();
    }
    //#endregion--------------------------------------------------------------------------------------

}
