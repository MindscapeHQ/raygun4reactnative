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
import android.util.Log;
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
  // Is the NativeBridge initialized
  private boolean initialized = false;
  // Max number of CrashReports that can be stored.
  private int cacheSize = 10;
  // Maintains a value of when the ReactNativeBridgePackage was initiated (start of the project).
  private final long startedTime;
  // Constants that indicate the current state of the Activity.
  private static final String ON_RESUME = "ON_RESUME";
  private static final String ON_PAUSE = "ON_PAUSE";
  private static final String ON_DESTROY = "ON_DESTROY";
  private static final String ON_START = "ON_START";
  private static final String DEVICE_ID = "DEVICE_ID";
  private static final String STORAGE_KEY = "__RAYGUN_CRASH_REPORT__";
  //#endregion--------------------------------------------------------------------------------------

  //#region---CONSTRUCTION METHODS------------------------------------------------------------------
  public RaygunNativeBridgeModule(ReactApplicationContext context, long startedAt) {
    super(context);
    reactContext = context;
    startedTime = startedAt;
  }

  @Override
  public @NotNull String getName() {
    return "RaygunNativeBridge";
  }

  @ReactMethod
  public void init(ReadableMap options) {
    Timber.i(options.toString());
    if (initialized) {
      Timber.i("Already initialized");
      return;
    }
    String apiKey = options.getString("apiKey");
    String version = options.getString("version");
    String customCREndpoint = options.getString("customCrashReportingEndpoint");
    boolean enableRealUserMonitoring = options.getBoolean("enableRealUserMonitoring");
    RaygunClient.init(reactContext, apiKey, version);
    initialized = true;

    RaygunClient.setOnBeforeSend(new OnBeforeSendHandler());
    Timber.i(customCREndpoint);
    RaygunClient.setCustomCrashReportingEndpoint(customCREndpoint);

    if (enableRealUserMonitoring) {
      reactContext.addLifecycleEventListener(this);
      long ms = SystemClock.uptimeMillis() - startedTime;
      WritableMap payload = Arguments.createMap();
      payload.putString("name", getActivityName());
      payload.putInt("duration", (int) ms);
      sendJSEvent(ON_START, payload);
    }
  }
  //#endregion--------------------------------------------------------------------------------------

  //#region---INFORMATION GATHERING METHODS---------------------------------------------------------
  @ReactMethod
  public void hasInitialized(Promise promise) {
    promise.resolve(initialized);
  }

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


  private String getActivityName() {
    return reactContext.getCurrentActivity().getClass().getSimpleName();
  }
  //#endregion--------------------------------------------------------------------------------------

  //#region---REAL USER MONITORING EVENT EMITTING METHODS-------------------------------------------
  /**
   * Emit an event on the JS side that has been recorded as occurring on the Native Side.
   * @param eventType - START, RESUME, PAUSE, DESTROY
   * @param payload - WritableMap with format {"name": String, "duration": Number}.
   */
  private void sendJSEvent(String eventType, @Nullable WritableMap payload) {
    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventType, payload);
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
  //#endregion--------------------------------------------------------------------------------------

  //#region---CRASH REPORTING CACHING METHOD--------------------------------------------------------
  @RequiresApi(api = Build.VERSION_CODES.KITKAT)
  @ReactMethod
  public void cacheCrashReport(String report, Promise promise) {
    Timber.tag("Cached Report").d(report);
    SharedPreferences preferences = reactContext
      .getSharedPreferences(STORAGE_KEY, Context.MODE_PRIVATE);
    String reportsJson = preferences.getString("reports", "[]"); //Retrieve the cache
    try {
      JSONArray reports = new JSONArray(reportsJson);
      while (reports.length() >= cacheSize) {
        reports.remove(0); //Clip to max size cache
      }
      //Add the new report and store the new cache
      reports.put(new JSONObject(report));
      preferences.edit().putString("reports", reports.toString()).apply();
      promise.resolve(null);
    } catch (Exception e) {
      Timber.tag("Save Report Error").e(e);
      promise.reject(e);
    }
  }

  private static class OnBeforeSendHandler implements CrashReportingOnBeforeSend {
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
  //#endregion--------------------------------------------------------------------------------------

  //#region---UPDATE NATIVE TO MATCH REACT METHODS--------------------------------------------------

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
  @ReactMethod
  public void setCacheSize(int newSize, Promise promise) {
    //Set the cache size to the new value clamped between the min and max
    cacheSize = Math.max(0, Math.min(newSize, 64));
  }

  //#endregion--------------------------------------------------------------------------------------

  //#region---CLEAR & UPDATE INFORMATION------------------------------------------------------------

  @ReactMethod
  public void cacheEmpty(Promise promise) {
    String cache = reactContext.getSharedPreferences(STORAGE_KEY, Context.MODE_PRIVATE)
      .getString("reports", "[]");
    promise.resolve(cache.equals("[]"));
  }

  @RequiresApi(api = Build.VERSION_CODES.KITKAT)
  @ReactMethod
  public void flushCrashReportCache(Promise promise) {
    SharedPreferences preferences = reactContext
      .getSharedPreferences(STORAGE_KEY, Context.MODE_PRIVATE);
    String reportsJson = preferences.getString("reports", "[]"); //Retrieve the cache
    preferences.edit().putString("reports", "[]").apply(); //Clear the cache
    promise.resolve(reportsJson); //Return its contents
  }

  @ReactMethod
  public void clearSession() {
    RaygunClient.clearBreadcrumbs();
    RaygunClient.setCustomData(new HashMap<>());
    RaygunClient.setUser("");
    RaygunClient.setTags(new ArrayList<>());
  }
  //#endregion--------------------------------------------------------------------------------------
}
