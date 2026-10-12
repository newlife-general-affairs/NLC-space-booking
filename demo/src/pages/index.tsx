import HelloTemplate from '../components/HelloTemplate';
import TableList from '../components/Table';
import Theme from '../components/Theme/index';
import { microProps } from '../index';
import styled from './index.module.less';
const Page = () => {
  const { dynamicProps } = microProps;
  dynamicProps.setBreadcrumb([{ type: 'auto' }]);
  return (
    <div className={styled['layout']}>
      <HelloTemplate />
      <TableList />
      <Theme />
    </div>
  );
};

export default Page;
