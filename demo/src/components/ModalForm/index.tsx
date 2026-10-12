/**
 * 集成form的modal
 */
import React, { useEffect, useState } from 'react';
import { Modal, Form } from 'antd';

const { useForm } = Form;

const layout = {
  labelCol: { span: 6 },
  wrapperCol: { span: 16 },
};

const ModalForm = ({
  visible = false,
  onOk = (values: any) => {
    return Promise.resolve(true);
  },
  onCancel = () => {},
  title = '',
  // @ts-ignore
  children,
  nameList = [],
  formData = {},
}) => {
  const [form] = useForm();
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue(formData);
    }
  }, [visible]);

  return (
    <Modal
      destroyOnClose
      maskClosable={false}
      visible={visible}
      title={title}
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={() => {
        if (!nameList.length) {
          form
            .validateFields()
            .then(values => {
              setConfirmLoading(true);
              onOk({
                ...formData,
                ...values,
              }).then(() => {
                setConfirmLoading(false);
                form.resetFields();
              });
            })
            .catch(info => {
              console.error('Validate Failed:', info);
            });
          return;
        }

        form
          .validateFields(nameList)
          .then(values => {
            setConfirmLoading(true);
            onOk({
              ...formData,
              ...values,
            }).then(() => {
              setConfirmLoading(false);
              form.resetFields();
            });
          })
          .catch(info => {
            console.error('Validate Failed:', info);
          });
      }}
    >
      <Form form={form} preserve={false} {...layout}>
        {children}
      </Form>
    </Modal>
  );
};

export default ModalForm;
