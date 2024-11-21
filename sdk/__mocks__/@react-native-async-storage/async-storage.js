export * from '@react-native-async-storage/async-storage/jest/async-storage-mock';

var storage = {};

export default {
  getItem: (item, value = null) => {
    return new Promise((resolve, reject) => {
      storage[item] ? resolve(storage[item]) : resolve(value);
    });
  },
  setItem: (item, value) => {
    return new Promise((resolve, reject) => {
      storage[item] = value;
      resolve(value);
    });
  }
};
