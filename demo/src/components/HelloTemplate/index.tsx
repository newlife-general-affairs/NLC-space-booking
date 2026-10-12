import { useTranslation } from 'react-i18next';
import { Box } from '@tuya-sat/galaxy';
import logo from '../../assets/logo.png';
import styled from './index.module.less';
const HelloTemplate = function () {
  const { t } = useTranslation();
  return (
    <Box className={`${styled['layout']} layout`}>
      <img src={logo} alt="logo" width={50} />
      <p>{t('micro.title')}</p>
      <p>
        {t('micro.see')}
        <a href="https://saturn.tuyacn.com">{t('micro.saturn')}</a>
        {t('micro.more')}
      </p>
    </Box>
  );
};
export default HelloTemplate;
