import { registerRootComponent } from 'expo';
import App from './App';

if (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production') {
  // Bridge native network requests to Chrome DevTools when using Remote JS Debugger
  // @ts-ignore
  if (typeof global !== 'undefined' && global.originalXMLHttpRequest) {
    // @ts-ignore
    global.XMLHttpRequest = global.originalXMLHttpRequest;
    // @ts-ignore
    global.FormData = global.originalFormData ? global.originalFormData : global.FormData;
  }
}

registerRootComponent(App);
