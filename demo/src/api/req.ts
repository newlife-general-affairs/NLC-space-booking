import { AxiosRequestConfig } from 'axios';

const onFulfilled = (config: AxiosRequestConfig) => {
  config.headers = {
    ...config.headers,
    'Content-Type': 'application/json;charset=utf-8',
  };
  return config;
};

const onRejected = (error: Error) => Promise.reject(error);

const req = { onFulfilled, onRejected };

export default req;
