import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Card,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  PlusOutlined
} from "@ant-design/icons";
import { api, RankChangeItem, RankChangeResponse } from "../api/client";

const metricLabels: Record<string, string> = {
  fans_count: "粉丝数",
  read_count: "阅读数",
  click_rate: "商品点击率",
  pay_conversion_rate: "支付转化率",
  gmv: "成交金额",
  publish_time: "发布时间"
};

type RankType = "note" | "account";

export default function RankChangePage() {
  const [viewType, setViewType] = useState<RankType>("note");
  const [data, setData] = useState<RankChangeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async (type: RankType) => {
    setLoading(true);
    try {
      const resp = await api.get<{ ok: boolean; data: RankChangeResponse; error?: string }>(
        "/rank_change",
        { params: { type } }
      );
      if (!resp.data.ok) {
        throw new Error(resp.data.error || "接口返回错误");
      }
      setData(resp.data.data);
    } catch (err: any) {
      console.error(err);
      message.error(err?.message || "加载排名变化失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(viewType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewType]);

  const columns: ColumnsType<RankChangeItem> = useMemo(() => {
    const baseColumns: ColumnsType<RankChangeItem> = [
      {
        title: "排名变化",
        dataIndex: "rank_change",
        width: 120,
        render: (_value, record) => renderRankChange(record)
      },
      {
        title: "当前排名",
        dataIndex: "current_rank",
        width: 100
      },
      {
        title: viewType === "note" ? "笔记标题 / 账号" : "店铺 / 粉丝",
        dataIndex: "name",
        render: (_value, record) => renderEntity(record, viewType)
      }
    ];

    const metrics =
      viewType === "note"
        ? ["read_count", "click_rate", "pay_conversion_rate", "gmv"]
        : ["fans_count", "read_count", "click_rate", "pay_conversion_rate", "gmv"];

    const metricColumns = metrics.map((key) => ({
      title: metricLabels[key],
      dataIndex: key,
      render: (_value: unknown, record: RankChangeItem) =>
        renderMetric(key, record),
      width: 150
    }));

    return [...baseColumns, ...metricColumns];
  }, [viewType]);

  const description =
    data?.current_date && data?.previous_date
      ? `对比日期：${data.current_date}（当前） vs ${data.previous_date}（前一日）`
      : "当前数据不足以比较最近两天。";

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <Card>
        <Space
          direction="vertical"
          style={{ width: "100%" }}
          size="middle"
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              排名变化趋势
            </Typography.Title>
            <Segmented
              options={[
                { label: "笔记榜", value: "note" },
                { label: "账号榜", value: "account" }
              ]}
              value={viewType}
              onChange={(val) => setViewType(val as RankType)}
            />
          </div>
          <Alert type="info" message={description} showIcon />
        </Space>
      </Card>

      <Table<RankChangeItem>
        rowKey="key"
        loading={loading}
        columns={columns}
        dataSource={data?.items || []}
        pagination={{ pageSize: 20 }}
        locale={{
          emptyText: data?.current_date
            ? "没有找到数据"
            : "需要至少两天的数据才能比较排名变化"
        }}
        scroll={{ x: 900 }}
      />
    </Space>
  );
}

function renderRankChange(record: RankChangeItem) {
  if (record.previous_rank == null || record.rank_change == null) {
    return (
      <Tag icon={<PlusOutlined />} color="blue">
        新增
      </Tag>
    );
  }
  if (record.rank_change === 0) {
    return (
      <Tag icon={<MinusOutlined />} color="default">
        持平
      </Tag>
    );
  }
  if (record.rank_change > 0) {
    return (
      <Tag icon={<ArrowUpOutlined />} color="green">
        +{record.rank_change}
      </Tag>
    );
  }
  return (
    <Tag icon={<ArrowDownOutlined />} color="red">
      {record.rank_change}
    </Tag>
  );
}

function renderEntity(record: RankChangeItem, viewType: RankType) {
  if (viewType === "note") {
    return (
      <Space direction="vertical" size={4}>
        <Typography.Text strong>{record.title || "-"}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {record.nickname || "未知账号"}
        </Typography.Text>
      </Space>
    );
  }
  return (
    <Space direction="vertical" size={4}>
      <Typography.Text strong>{record.shop_name || "-"}</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        粉丝：{record.current?.fans_count || "-"}
      </Typography.Text>
    </Space>
  );
}

function renderMetric(field: string, record: RankChangeItem) {
  const currentValue = record.current?.[field] ?? "-";
  const previousValue = record.previous?.[field] ?? null;
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{currentValue || "-"}</div>
      <div style={{ color: "#9ca3af", fontSize: 12 }}>
        {previousValue ? `前一日：${previousValue}` : "前一日：—"}
      </div>
    </div>
  );
}
