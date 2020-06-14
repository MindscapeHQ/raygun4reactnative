package com.raygun.react;

import android.content.ComponentName;
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
import com.raygun.raygun4android.messages.crashreporting.RaygunMessageDetails;
import com.raygun.raygun4android.messages.shared.RaygunUserInfo;
import com.raygun.raygun4android.services.CrashReportingPostService;

import com.facebook.react.bridge.ReadableMap;

import java.util.ArrayList;
import java.util.HashMap;

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
        RaygunClient.init(this.reactContext, apiKey, version);
        RaygunClient.setOnBeforeSend(new OnBeforeSendHandler());
    }

    @ReactMethod
    public void sendCrashReport(String jsonPayload, String apiKey) {
        Intent intent = new Intent(RaygunClient.getApplicationContext(), CrashReportingPostService.class);
        intent.setAction("com.raygun.raygun4android.intent.action.LAUNCH_CRASHREPORTING_POST_SERVICE");
        intent.setPackage("com.raygun.raygun4android");
        intent.setComponent(new ComponentName(RaygunClient.getApplicationContext(), CrashReportingPostService.class));
        intent.putExtra("msg", jsonPayload);
        intent.putExtra("apikey", apiKey);

        CrashReportingPostService.enqueueWork(RaygunClient.getApplicationContext(), intent);
    }

    @ReactMethod
    public void setUser(ReadableMap userObj) {
        RaygunUserInfo user = new RaygunUserInfo(
                userObj.getString("id"),
                userObj.getString("firstName"),
                userObj.getString("fullName"),
                userObj.getString("email"));

        RaygunClient.setUser(user);
    }

    @ReactMethod
    public void setTags(ArrayList<String> tags) {
        RaygunClient.setTags(tags);
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
        String className = breadcrumb.getString("className");
        String methodName = breadcrumb.getString("methodName");
        Integer lineNumber = breadcrumb.getInt("lineNumber");
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
                .className(className)
                .methodName(methodName)
                .lineNumber(lineNumber)
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
