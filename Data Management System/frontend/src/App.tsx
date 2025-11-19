import { Layout, Tabs, Typography, theme } from "antd";
import { AuditOutlined, BookOutlined, ShopOutlined } from "@ant-design/icons";
import NoteRankPage from "./pages/NoteRank";
import AccountRankPage from "./pages/AccountRank";
import AuditLogPage from "./pages/AuditLog";

const { Header, Content } = Layout;

export default function App() {
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 8
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          Data Management System
        </Typography.Title>
        <Typography.Text type="secondary">
          XHS 热卖榜/成交榜 数据后台（本地）
        </Typography.Text>
      </Header>
      <Content style={{ padding: 24 }}>
        <div
          style={{
            background: colorBgContainer,
            padding: 16,
            borderRadius: borderRadiusLG,
            minHeight: "calc(100vh - 112px)"
          }}
        >
          <Tabs
            defaultActiveKey="note"
            items={[
              {
                key: "note",
                label: (
                  <span>
                    <BookOutlined /> 笔记榜
                  </span>
                ),
                children: <NoteRankPage />
              },
              {
                key: "account",
                label: (
                  <span>
                    <ShopOutlined /> 账号榜
                  </span>
                ),
                children: <AccountRankPage />
              },
              {
                key: "audit",
                label: (
                  <span>
                    <AuditOutlined /> 审计日志
                  </span>
                ),
                children: <AuditLogPage />
              }
            ]}
          />
        </div>
      </Content>
    </Layout>
  );
}
