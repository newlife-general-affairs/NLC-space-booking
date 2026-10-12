import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import req from './req';
import res from './res';

export interface ResData<T> {
  code: number;
  msg?: string;
  result?: T;
  [keys: string]: any;
}

export interface IAxiosInstance extends AxiosInstance {
  request<T = any, R = ResData<T>>(config: AxiosRequestConfig): Promise<R>;
  get<T = any, R = ResData<T>>(url: string, config?: AxiosRequestConfig): Promise<R>;
  delete<T = any, R = ResData<T>>(
    url: string,
    user_ids?: any,
    config?: AxiosRequestConfig
  ): Promise<R>;
  head<T = any, R = ResData<T>>(url: string, config?: AxiosRequestConfig): Promise<R>;
  post<T = any, R = ResData<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>;
  put<T = any, R = ResData<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>;
  patch<T = any, R = ResData<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>;
}

const api: IAxiosInstance = axios.create();

//请求拦截
api.interceptors.request.use(req.onFulfilled, req.onRejected);

//响应拦截
api.interceptors.response.use(res.onFulfilled, res.onRejected);

export default api;
