package com.raygun.react;

import static android.provider.Settings.Secure.getString;

import android.annotation.SuppressLint;
import android.app.ActivityManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import androidx.annotation.RequiresApi;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import javax.annotation.Nullable;
import org.jetbrains.annotations.NotNull;
import org.json.JSONArray;
import org.json.JSONObject;
import timber.log.Timber;

public class RaygunNativeBridgeModule extends ReactContextBaseJavaModule implements
  LifecycleEventListener {

  //#region---GLOBAL CONSTANTS----------------------------------------------------------------------
  // ReactNative Context, a connection the the React Code.
  private static ReactApplicationContext reactContext;
  // Is the NativeBridge/RUMEventHandler initialized
  private boolean initialized = false;
  private boolean lifecycleInitialized = false;
  // Maintains a value of when the ReactNativeBridgePackage was initiated (start of the project).
  private final long startedTime;

  // Session state change events
  private static final String ON_SESSION_RESUME = "ON_SESSION_RESUME";
  private static final String ON_SESSION_PAUSE = "ON_SESSION_PAUSE";
  private static final String ON_SESSION_END = "ON_SESSION_END";

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
    startedTime = startedAt;
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
    if (initialized) {
      Timber.i("ReactNativeBridge already initialized");
      return;
    }

    RaygunClient.init(reactContext, apiKey, version);
    RaygunClient.enableCrashReporting();
    RaygunClient.setOnBeforeSend(new OnBeforeSendHandler());
    RaygunClient.setCustomCrashReportingEndpoint(customCrashReportingEndpoint);

    initialized = true;
  }

  /**
   * This method is used by the RealUserMonitor to instantiate the LifecycleEventListeners. This is
   * not included with the 'init' method, as the RealUserMonitor needs this code to be run
   * independently. However, if RUM is not enabled, then this would provide some unnecessary
   * performance downgrades, hence why it is only instantiated if RUM is enabled.
   */
  @ReactMethod
  public void initRealUserMonitoringNativeSupport() {
    if (lifecycleInitialized) {
      Timber.i("Lifecycle Event listener already initialized");
      return;
    }

    reactContext.addLifecycleEventListener(this);
    long ms = SystemClock.uptimeMillis() - startedTime;
    WritableMap payload = Arguments.createMap();
    payload.putString("name", getActivityName());
    payload.putInt("duration", (int) ms);
    lifecycleInitialized = true;
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
        System.out.println("DO NOT SEND: " + raygunMessage.getDetails().getError().getMessage());
        return null;
      }
      return raygunMessage;
    }
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

  /**
   * Gets the name of the activity (current view of the application where the UI resides). This is
   * used to monitor events on the screen and to maintain a track on the window responsible for the
   * application.
   *
   * @return - String, value assigned to the activity to identify it.
   */
  private String getActivityName() {
    return reactContext.getCurrentActivity().getClass().getSimpleName();
  }
  //#endregion--------------------------------------------------------------------------------------

  //#region---REAL USER MONITORING EVENT EMITTING METHODS-------------------------------------------

  /**
   * Emits an event to the ReactContext.
   *
   * @param eventType - Should be one of the KEY values, START, RESUME, PAUSE, DESTROY.
   * @param payload   - A WritableMap of information to be parsed with this event's occurence.
   */
  private void sendJSEvent(String eventType, @Nullable WritableMap payload) {
    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventType, payload);
  }

  /**
   * When the HOST clicks back into the Application, see following actions.
   * <p>
   * Host OPENS application. Host goes to ANOTHER application. Host SWAPS back to THIS application
   * (resume is run).
   */
  @Override
  public void onHostResume() {
    WritableMap payload = Arguments.createMap();
    payload.putString("name", getActivityName());
    this.sendJSEvent(ON_SESSION_RESUME, payload);
  }

  /**
   * When the HOST clicks out of the Application without closing it, see following actions.
   * <p>
   * Host OPENS application. Host goes to ANOTHER application (pause is run).
   */
  @Override
  public void onHostPause() {
    WritableMap payload = Arguments.createMap();
    payload.putString("name", getActivityName());
    this.sendJSEvent(ON_SESSION_PAUSE, payload);
  }

  /**
   * When the HOST closes the app (no longer running in the background).
   */
  @Override
  public void onHostDestroy() {
    WritableMap payload = Arguments.createMap();
    payload.putString("name", getActivityName());
    this.sendJSEvent(ON_SESSION_END, payload);
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
