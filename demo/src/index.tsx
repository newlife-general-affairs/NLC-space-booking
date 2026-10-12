import './public-path';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { getI18n } from 'react-i18next';
import { message } from 'antd';
import { CaptureContext, Event, Severity } from '@sentry/types';
import App from './App';
import './lang';
import './index.css';
import './styles/global.less';

export interface IQiankunProps {
  base: string;
  container: HTMLElement; // 子应用所在容器
  dynamicProps: DynamicProps; // 面包屑
  getOwnMenu: () => { entry_name: string }; // 获取当前选中菜单
  hasPermission: (permissionCode: string) => boolean;
  isSupportMobile: boolean; // 是否支持移动端
  mainHistory: mainHistory; // 用于微应用间跳转
  modifySelectedMenu: () => void; //
  region: 'tx' | 'us' | 'eu' | 'in' | 'ueaz' | 'we' | 'sea';
  resourcePrefix: string; // 静态资源地址
  sentry: {
    captureEvent: (event: Event) => string;
    captureMessage: (message: string, captureContext?: CaptureContext | Severity) => string;
    captureException: (exception: any, captureContext?: CaptureContext) => string;
  };
  tyLang: 'zh' | 'en'; // 当前语言
  langResource: any;
}
export let microProps: IQiankunProps;

function render(props: IQiankunProps) {
  const { base, container } = props as IQiankunProps;
  const root = (
    container ? container.querySelector('#root') : document.querySelector('#root')
  ) as HTMLElement;
  message.config({
    getContainer: () => root,
  });
  ReactDOM.render(
    <BrowserRouter basename={window.__POWERED_BY_QIANKUN__ ? base : '/'}>
      <App {...props} />
    </BrowserRouter>,
    root
  );
}

if (!window.__POWERED_BY_QIANKUN__) {
  render({} as IQiankunProps);
}

export async function bootstrap() {
  console.log('子应用启动');
}

export async function mount(props: IQiankunProps) {
  console.log('挂载子应用', props);
  props.langResource && replaceLangResource(props.langResource);
  getI18n().changeLanguage(props.tyLang);
  microProps = props;
  render(props);
}

export async function unmount(props: IQiankunProps) {
  const { container } = props;
  message.destroy();
  const root = (
    container ? container.querySelector('#root') : document.querySelector('#root')
  ) as HTMLElement;
  ReactDOM.unmountComponentAtNode(root);
}

function replaceLangResource(langResource: any) {
  Object.keys(langResource).forEach(langkey => {
    getI18n().addResourceBundle(langkey, 'translation', langResource[langkey]);
  });
}
