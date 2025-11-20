import { Layout, Menu, Typography, theme } from "antd";
import {
  AuditOutlined,
  BookOutlined,
  ShopOutlined,
  RiseOutlined
} from "@ant-design/icons";
import NoteRankPage from "./pages/NoteRank";
import AccountRankPage from "./pages/AccountRank";
import AuditLogPage from "./pages/AuditLog";
import RankChangePage from "./pages/RankChange";
import { useState } from "react";

const { Header, Content, Sider } = Layout;

export default function App() {
  const [activePage, setActivePage] = useState("note");
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken();

  const renderPage = () => {
    switch (activePage) {
      case "account":
        return <AccountRankPage />;
      case "rank-change":
        return <RankChangePage />;
      case "audit":
        return <AuditLogPage />;
      case "note":
      default:
        return <NoteRankPage />;
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth={0} width={220}>
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            color: "#fff",
            fontWeight: 600,
            fontSize: 16
          }}
        >
          数据导航
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activePage]}
          onClick={({ key }) => setActivePage(key)}
          items={[
            {
              key: "note",
              icon: <BookOutlined />,
              label: "笔记榜概览"
            },
            {
              key: "account",
              icon: <ShopOutlined />,
              label: "账号榜概览"
            },
            {
              key: "rank-change",
              icon: <RiseOutlined />,
              label: "排名变化"
            },
            {
              key: "audit",
              icon: <AuditOutlined />,
              label: "审计日志"
            }
          ]}
        />
      </Sider>
      <Layout>
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
            {renderPage()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
