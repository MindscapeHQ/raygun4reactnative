import RaygunClient from '@sundayempire/raygun4reactnative';

const throwUndefinedError = () => {
  //@ts-ignore
  global.undefinedFn();
};

const throwCustomError = (msg: string) => {
  throw new Error(msg);
};

const promiseRejection = async () => {
  throw Error('Rejection');
};

const reInitialize = () => {
  RaygunClient.init({
    apiKey: 't2IwCSF44QbvhJLwDKL7Kw',
    version: 'App-version',
  });
};

const makeNetworkCall = () => {
  fetch('https://www.google.com')
    .then(({headers}) =>
      console.log('Fetch call completed', headers.get('date')),
    )
    .catch(console.log);
};

export {
  throwUndefinedError,
  throwCustomError,
  promiseRejection,
  reInitialize,
  makeNetworkCall,
};
