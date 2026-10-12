import { Box } from '@tuya-sat/galaxy';
import { useTranslation } from 'react-i18next';

import styled from './index.module.less';

const Theme = function () {
  const { t } = useTranslation();
  return (
    <>
      <h3>主题色明暗示例</h3>
      <Box className={`layout ${styled.theme}`}>
        <div className={styled.content}>
          <h3>{t('theme.antdCSSVar')}</h3>
          <div className={`${styled['antd-css-var']} square`}></div>
        </div>

        <div className={styled.content}>
          <h3>{t('theme.appGlobalCSSClass')}</h3>
          <div className={`global-cls square`}></div>
        </div>

        <div className={styled.content}>
          <h3>{t('theme.appCustomCSSVariable')}</h3>
          <div className={`${styled['css-var']} square`}></div>
        </div>
      </Box>
    </>
  );
};
export default Theme;
