import { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Form, Input, Space, Table, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { api, AuditLogItem, ListResponse } from "../api/client";

type Filters = {
  action?: string;
  detail_q?: string;
  created_from?: string;
  created_to?: string;
};

export default function AuditLogPage() {
  const [form] = Form.useForm<{
    action?: string;
    detail_q?: string;
    created_range?: [Dayjs, Dayjs];
  }>();
  const [data, setData] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState({
    page: 1,
    pageSize: 20
  });
  const [filters, setFilters] = useState<Filters>({});

  const columns: ColumnsType<AuditLogItem> = useMemo(
    () => [
      {
        title: "Action",
        dataIndex: "action",
        width: 200
      },
      {
        title: "Detail",
        dataIndex: "detail",
        ellipsis: true
      },
      {
        title: "时间",
        dataIndex: "created_at",
        width: 200
      }
    ],
    []
  );

  const fetchData = async (
    page = pageState.page,
    pageSize = pageState.pageSize,
    nextFilters = filters
  ) => {
    setLoading(true);
    try {
      const resp = await api.get<ListResponse<AuditLogItem>>("/audit_log", {
        params: {
          page,
          page_size: pageSize,
          action: nextFilters.action,
          detail_q: nextFilters.detail_q,
          created_from: nextFilters.created_from,
          created_to: nextFilters.created_to
        }
      });

      if (!resp.data.ok) {
        throw new Error(resp.data.error || "接口返回错误");
      }

      setData(resp.data.data.items);
      setTotal(resp.data.data.total);
      setPageState({ page, pageSize });
      setFilters(nextFilters);
    } catch (err: any) {
      console.error(err);
      message.error(err?.message || "加载审计日志失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    fetchData(pagination.current || 1, pagination.pageSize || 20, filters);
  };

  const handleSearch = () => {
    const values = form.getFieldsValue();
    const nextFilters: Filters = {
      action: values.action?.trim() || undefined,
      detail_q: values.detail_q?.trim() || undefined
    };
    if (values.created_range && values.created_range.length === 2) {
      nextFilters.created_from = values.created_range[0].toISOString();
      nextFilters.created_to = values.created_range[1].toISOString();
    }
    fetchData(1, pageState.pageSize, nextFilters);
  };

  const handleReset = () => {
    form.resetFields();
    fetchData(1, pageState.pageSize, {});
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Form
        form={form}
        layout="inline"
        onFinish={handleSearch}
        style={{ rowGap: 12 }}
      >
        <Form.Item label="Action" name="action">
          <Input allowClear placeholder="如 insert_note_rank" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item label="Detail" name="detail_q">
          <Input allowClear placeholder="detail 模糊" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item label="时间" name="created_range">
          <DatePicker.RangePicker showTime style={{ width: 320 }} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<AuditLogItem>
        rowKey="uuid"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={{
          current: pageState.page,
          pageSize: pageState.pageSize,
          total,
          showSizeChanger: true
        }}
        onChange={handleTableChange}
      />
    </Space>
  );
}
