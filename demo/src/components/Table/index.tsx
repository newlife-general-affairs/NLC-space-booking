import { FormPage, GalaxyProvider } from '@tuya-sat/galaxy';
import { GalaxyTableColumn } from '@tuya-sat/galaxy/lib/list/interface';
import { Button, message, Space, Form, Input } from 'antd';
import { useEffect, useState } from 'react';
import { getI18n, useTranslation } from 'react-i18next';
import api from '../../api';
import { microProps } from '../../index';
import styled from './index.module.less';
import ModalForm from '../ModalForm';

interface IRecord {
  create_time: string;
  roles: IRoles[];
  user_id: string;
  user_name: string;
  user_nick_name: string;
}

interface IRoles {
  remark: string;
  role_code: string;
  role_name: string;
}
const TableList = function () {
  const i18n = getI18n();
  const [dataSource, setDataSouce] = useState<{ data: never[]; totalRecord: number }>({
    data: [],
    totalRecord: 0,
  });
  const [modalInfo, setModalInfo] = useState({
    visible: false,
    formData: {},
  });

  function openModal(user: any) {
    setModalInfo({
      visible: true,
      formData: user,
    });
  }

  function closeModal() {
    setModalInfo({ visible: false, formData: {} });
  }


  const { hasPermission } = microProps;

  const { t } = useTranslation();

  const columns: GalaxyTableColumn<any>[] = [
    {
      title: t('table.name'),
      dataIndex: 'user_nick_name',
    },
    {
      title: t('table.username'),
      dataIndex: 'user_name',
    },
    {
      title: t('table.rolename'),
      dataIndex: 'role_name',
      render: (text: IRoles, record: IRecord) => {
        let name;
        if (record?.roles?.length) {
          name = record.roles[0].role_name;
        }
        return name;
      },
    },
    {
      title: t('table.create'),
      dataIndex: 'create_time',
      // render: (text: string) => {
      //   return <TimeShow value={Number(text)} />;
      // },
    },
    {
      title: t('table.action'),
      dataIndex: 'action',
      render: (text: string, record: IRecord) => (
        <Space size="middle">
          <Button
            type="link"
            disabled={!hasPermission!('EDIT')}
            onClick={() => openModal(record)}
          >
            {t('table.edit')}
          </Button>
          <Button
            type="link"
            disabled={!hasPermission!('DELETE')}
            onClick={() => deleteUsers(record.user_id)}
          >
            {t('table.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  async function editUser(user: any) {
    const editPermission = hasPermission('EDIT');

    if (!editPermission) {
      message.error(t('permission.title'));
      return false;
    }

    const { user_id, user_nick_name, roles } = user;
    await api.put('/open-api/v1.0/users', {
      user_id,
      user_nick_name,
      role_codes: roles.map((item: any) => item.role_code),
    });
    getList();
    closeModal();
    return true;
  }
  function deleteUsers(userid: string) {
    const deletePermission = hasPermission!('DELETE');
    if (deletePermission === false) {
      message.error(t('permission.title'));
    } else {
      message.success(t('permission.success'));
    }
  }

  function getList() {
    api
      .get('/open-api/v1.0/users')
      .then(res => {
        setDataSouce({ data: res.result.data, totalRecord: res.result.data.length });
      })
      .catch(e => console.log(e));
  }
  useEffect(() => {
    getList();
  }, []);

  function submit(data: any) {
    console.log('submit', data);
  }
  return (
    <div className={`${styled['table']} layout`}>
      <h3>用户管理 API 调用示例</h3>
      <GalaxyProvider
        antdConfigProvider={{
          renderEmpty: () => t('permission.title'),
        }}
      >
        <FormPage
          submit={submit}
          listProps={{ columns, rowKey: 'user_id' }}
          dataSource={dataSource}
        />
      </GalaxyProvider>
      <ModalForm
        title={t('table.modalTitle')}
        visible={modalInfo.visible}
        formData={modalInfo.formData}
        onOk={editUser}
        onCancel={closeModal}
      >
        <Form.Item name="user_nick_name" label={t('table.name')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </ModalForm>
    </div>
  );
};

export default TableList;
