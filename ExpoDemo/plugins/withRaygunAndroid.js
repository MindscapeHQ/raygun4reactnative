const { withAndroidManifest } = require("expo/config-plugins");

function addServiceIfMissing(services, serviceDef) {
  const exists = services.some(
    (s) => s.$["android:name"] === serviceDef.$["android:name"]
  );
  if (!exists) {
    services.push(serviceDef);
  }
}

function withRaygunAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (!mainApplication) return config;

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    addServiceIfMissing(mainApplication.service, {
      $: {
        "android:name":
          "com.raygun.raygun4android.services.CrashReportingPostService",
        "android:exported": "false",
        "android:permission": "android.permission.BIND_JOB_SERVICE",
        "android:process": ":crashreportingpostservice",
      },
    });

    addServiceIfMissing(mainApplication.service, {
      $: {
        "android:name":
          "com.raygun.raygun4android.services.RUMPostService",
        "android:exported": "false",
        "android:permission": "android.permission.BIND_JOB_SERVICE",
        "android:process": ":rumpostservice",
      },
    });

    return config;
  });
}

module.exports = withRaygunAndroid;
