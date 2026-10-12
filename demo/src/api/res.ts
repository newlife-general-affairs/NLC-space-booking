import { AxiosResponse } from 'axios';
import { message } from 'antd';

const onFulfilled = (response: AxiosResponse<any>) => {
  const res = response.data;
  //统一业务异常处理（主要根据错误码）
  if (!res.success) {
    message.error(res.msg);
    return Promise.reject(res);
  }
  return res;
};

const onRejected = (error: Error) => Promise.reject(error);

const res = { onFulfilled, onRejected };

export default res;
