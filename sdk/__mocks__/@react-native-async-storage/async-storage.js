export * from '@react-native-async-storage/async-storage/jest/async-storage-mock';

export default {
    getItem: (item, value = null) => {
        return new Promise((resolve, reject) => {
            resolve(value);
        });
    },
    setItem: (item, value) => {
        return new Promise((resolve, reject) => {
            resolve(value);
        });
    }
}