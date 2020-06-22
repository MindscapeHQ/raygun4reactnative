const devServerErrorStack = {
  stack: `Error: Something went wrong
    at woops (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:104257:11)
    at Object.onPress (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:104339:16)
    at onPress (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:57097:27)
    at Pressability._performTransitionSideEffects (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:56648:15)
    at Pressability._receiveSignal (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:56586:16)
    at onResponderRelease (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:56504:20)
    at Object.invokeGuardedCallbackImpl (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:12763:16)
    at invokeGuardedCallback (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:12857:37)
    at invokeGuardedCallbackAndCatchFirstError (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:12861:31)
    at executeDispatch (http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false:12966:9)`
};

const releasedErrorStack = {
  stack: `s@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:397:272
       onPress@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:397:1641
       onPress@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:226:1701
       value@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:222:7541
       value@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:222:6754
       onResponderRelease@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:222:5557
       y@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:1126
       k@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:1269
       w@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:1323
       R@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:1618
       M@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:2402
       forEach@[native code]
       U@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:2202
       /Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:13819
       Pe@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:90853
       Re@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:13479
       Ie@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:13665
       receiveTouches@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:97:14449
       value@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:27:3545
       /Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:27:841
       value@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:27:2799
       value@/Users/kerwin.weng/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/Podify.app/main.jsbundle:27:813
       value@[native code]`
};

const internalStackFrames = [
  { file: 'main.jsbundle' },
  { file: 'forEach@[native code]' },
  {
    file:
      '/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/ReactNativeRenderer-dev.js'
  },
  {
    file:
      '/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/MessageQueue.js'
  },
  {
    file:
      '/Library/Developer/CoreSimulator/Devices/3D4BDAA5-3FA9-416D-91D4-8DDAED657604/data/Containers/Bundle/Application/986C1A58-CBBA-4D56-8215-6A7FAF85C0B0/MessageQueue.js'
  },
  { file: 'other.js' }
];

const stackFramesWithAddress = [
  { methodName: 'calls(address at .....)' },
  { methodName: 'calls (address at .....)' },
  { methodName: 'calls' }
];

const fullStackFrames = [
  { file: 'main.jsbundle', methodName: 'call', lineNumber: 1, column: 42 },
  { file: 'main.jsbundle', methodName: 'apply', lineNumber: 1, column: null }
];

export {
  devServerErrorStack,
  releasedErrorStack,
  internalStackFrames,
  stackFramesWithAddress,
  fullStackFrames
};
