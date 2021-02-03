package com.raygun.react;


import android.app.Activity;
import android.app.Application;
import android.app.Application.ActivityLifecycleCallbacks;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.lang.ref.WeakReference;
import java.util.HashMap;

import javax.annotation.Nullable;

import timber.log.Timber;

import static com.raygun.react.RaygunNativeBridgeModule.ON_SESSION_END;
import static com.raygun.react.RaygunNativeBridgeModule.ON_SESSION_PAUSE;
import static com.raygun.react.RaygunNativeBridgeModule.ON_SESSION_RESUME;
import static com.raygun.react.RaygunNativeBridgeModule.ON_VIEW_LOADED;
import static com.raygun.react.RaygunNativeBridgeModule.ON_VIEW_LOADING;

public class RaygunActivityLifecycleCallbacks implements ActivityLifecycleCallbacks {

    // ReactNative Context, a connection the the React Code.
    private static ReactApplicationContext reactContext;

    private static RaygunActivityLifecycleCallbacks RAYGUN_ACTIVITY_EVENT_LISTENER;

    private static boolean loaded = false;

    private static WeakReference<Activity> baseActivity;
    private static WeakReference<Activity> currentActivity;

    /**
     * Attaches the mainActivity to the RaygunActivityLifeCycleCall
     */
    public void attach(ReactApplicationContext context) {
        reactContext = context;

        if (reactContext.getCurrentActivity() != null) {
            baseActivity = new WeakReference<>(reactContext.getCurrentActivity());
            currentActivity = new WeakReference<>(reactContext.getCurrentActivity());
            reactContext.getCurrentActivity().getApplication().registerActivityLifecycleCallbacks(this);
        }
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle bundle) {
        Log.d("START", "HERE");
        if (!loaded) {
            if (currentActivity == null || currentActivity.get() != activity) {
                currentActivity = new WeakReference<>(activity);
            }

            WritableMap payload = Arguments.createMap();
            payload.putString("name", getActivityName());
            this.sendJSEvent(ON_VIEW_LOADING, payload);
        }
    }

    @Override
    public void onActivityStarted(Activity activity) {
        Log.d("START", "HERE2");
        if (!loaded) {
            if (currentActivity == null || currentActivity.get() != activity) {
                currentActivity = new WeakReference<>(activity);
            }
            WritableMap payload = Arguments.createMap();
            payload.putString("name", getActivityName());
            this.sendJSEvent(ON_VIEW_LOADING, payload);
        }
    }

    @Override
    public void onActivityResumed(Activity activity) {
        Log.d("START", "HERE3");
        currentActivity = new WeakReference<>(activity);
        WritableMap payload = Arguments.createMap();
        payload.putString("name", getActivityName());
        loaded = false;
        this.sendJSEvent(ON_SESSION_RESUME, payload);
    }

    @Override
    public void onActivityPaused(Activity activity) {
        WritableMap payload = Arguments.createMap();
        this.sendJSEvent(ON_SESSION_PAUSE, payload);
    }

    @Override
    public void onActivityStopped(Activity activity) {
        currentActivity = null;
        WritableMap payload = Arguments.createMap();
        this.sendJSEvent(ON_SESSION_END, payload);
    }

    @Override
    public void onActivitySaveInstanceState(Activity activity, Bundle bundle) {
    }

    @Override
    public void onActivityDestroyed(Activity activity) {
        WritableMap payload = Arguments.createMap();
        payload.putString("name", getActivityName());
        this.sendJSEvent(ON_SESSION_END, payload);
    }

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
     * Gets the name of the activity (current view of the application where the UI resides). This is
     * used to monitor events on the screen and to maintain a track on the window responsible for the
     * application.
     *
     * @return - String, value assigned to the activity to identify it.
     */
    private String getActivityName() {
        if (currentActivity != null) {
            return currentActivity.getClass().getSimpleName();
        }
        return "";
    }
}