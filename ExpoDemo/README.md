# Raygun for Expo demo project

This is an [Expo](https://expo.dev) project created following the instructions in the root `README.md` file.

## Running the project

1. Change the API key in `app/index.tsx`:

```tsx
  const options: RaygunClientOptions = {
    apiKey: "INSERT_YOUR_API_KEY_HERE",
    version: "0.1.2",
    enableCrashReporting: true,
    logLevel: LogLevel.verbose,
  };
```

2. Install dependencies

   ```bash
   npm install
   ```

3. Start the app

   ```bash
    npx expo start
   ```
