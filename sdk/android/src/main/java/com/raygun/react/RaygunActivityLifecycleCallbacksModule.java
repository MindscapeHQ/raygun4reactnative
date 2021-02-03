package com.raygun.react;


public class RaygunActivityLifecycleCallbacks implements ActivityLifecycleCallbacks {
    private static RaygunActivityLifecycleCallbacks RAYGUN_ACTIVITY_EVENT_LISTENER;

    private static WeakReference<Activity> mainActivity;
    private static WeakReference<Activity> currentActivity;
    private static WeakReference<Activity> loadingActivity;

    private static void attach(Activity mainActivity) {

        if (RAYGUN_ACTIVITY_EVENT_LISTENER.rum == null && mainActivity != null) {
            Application application = mainActivity.getApplication();

            if (application != null) {
                RAYGUN_ACTIVITY_EVENT_LISTENER.mainActivity = new WeakReference<>(mainActivity);
                RAYGUN_ACTIVITY_EVENT_LISTENER.currentActivity = new WeakReference<>(mainActivity);

                RaygunActivityLifecycleCallbacks.RAYGUN_ACTIVITY_EVENT_LISTENER = new RaygunActivityLifecycleCallbacks();
                application.registerActivityLifecycleCallbacks(RaygunActivityLifecycleCallbacks.RAYGUN_ACTIVITY_EVENT_LISTENER);
            }
        }
    }

}