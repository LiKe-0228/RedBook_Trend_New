import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Input,
  Space,
  Table,
  DatePicker,
  message,
  Tag
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { api, ListResponse, NoteRankItem } from "../api/client";

type Filters = {
  q?: string;
  fetch_date_from?: string;
  fetch_date_to?: string;
};

export default function NoteRankPage() {
  const [form] = Form.useForm<{
    q?: string;
    fetch_date_range?: [Dayjs, Dayjs];
  }>();
  const [data, setData] = useState<NoteRankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState({
    page: 1,
    pageSize: 20
  });
  const [filters, setFilters] = useState<Filters>({});

  const columns: ColumnsType<NoteRankItem> = useMemo(
    () => [
      {
        title: "标题",
        dataIndex: "title",
        ellipsis: true
      },
      {
        title: "账号昵称",
        dataIndex: "nickname",
        width: 160
      },
      {
        title: "发布时间",
        dataIndex: "publish_time",
        width: 150
      },
      {
        title: "阅读数",
        dataIndex: "read_count",
        width: 100
      },
      {
        title: "商品点击率",
        dataIndex: "click_rate",
        width: 110
      },
      {
        title: "支付转化率",
        dataIndex: "pay_conversion_rate",
        width: 110
      },
      {
        title: "成交金额",
        dataIndex: "gmv",
        width: 110
      },
      {
        title: "获取日期",
        dataIndex: "fetch_date",
        width: 110,
        render: (value) => <Tag>{value}</Tag>
      },
      {
        title: "入库时间",
        dataIndex: "created_at",
        width: 180
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
      const resp = await api.get<ListResponse<NoteRankItem>>("/note_rank", {
        params: {
          page,
          page_size: pageSize,
          q: nextFilters.q,
          fetch_date_from: nextFilters.fetch_date_from,
          fetch_date_to: nextFilters.fetch_date_to
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
      message.error(err?.message || "加载笔记榜失败");
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
      q: values.q?.trim() || undefined
    };
    if (values.fetch_date_range && values.fetch_date_range.length === 2) {
      nextFilters.fetch_date_from = values.fetch_date_range[0].format("YYYY-MM-DD");
      nextFilters.fetch_date_to = values.fetch_date_range[1].format("YYYY-MM-DD");
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
        <Form.Item label="关键词" name="q">
          <Input allowClear placeholder="标题/昵称 模糊搜索" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item label="获取日期" name="fetch_date_range">
          <DatePicker.RangePicker allowClear style={{ width: 260 }} />
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

      <Table<NoteRankItem>
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
        scroll={{ x: 1200 }}
      />
    </Space>
  );
}
