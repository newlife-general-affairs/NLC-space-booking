import { getI18n } from 'react-i18next';
import { ConfigProvider } from 'antd';
import Page from './pages';
import { useAntdLang } from 'src/utils/antdLang';
import './App.css';
import { IQiankunProps } from '.';

function App(props: IQiankunProps) {
  const i18n = getI18n();
  const { loading, lang } = useAntdLang(i18n.language);
  if (loading) {
    return <div></div>;
  }
  return (
    <ConfigProvider locale={lang} getPopupContainer={() => props.container || document.body}>
      <Page />
    </ConfigProvider>
  );
}

export default App;
