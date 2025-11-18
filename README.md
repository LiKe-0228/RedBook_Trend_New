# XHS 笔记/账号榜采集 & 飞书多维表上传脚本说明

本文记录从零开始使用这套工具的完整步骤，避免下次忘记。Windows 和 macOS 通用，差别主要在 Python 命令上。

---

## 一、前提准备

- 已安装 Python 3.9+（本机是 3.14）
- 已安装依赖（在项目根目录执行）：

  **Windows：**

  ```powershell
  cd D:\MyCode\RedBook_Trend
  python -m pip install flask flask-cors requests
  ```

  **macOS：**

  ```bash
  cd ~/MyCode/RedBook_Trend   # 路径按实际调整
  python3 -m pip install flask flask-cors requests
  ```

- 浏览器：Chrome / Edge（用于加载本地扩展）

---

## 二、配置本地参数（只做一次）

编辑项目根目录下的 `config_local.py`，主要填这些：

- 飞书应用：
  - `APP_ID`
  - `APP_SECRET`
- 内容榜多维表：
  - `BITABLE_NOTE_APP_TOKEN`
  - `BITABLE_NOTE_TABLE_ID`
- 账号榜多维表：
  - `BITABLE_ACCOUNT_APP_TOKEN`
  - `BITABLE_ACCOUNT_TABLE_ID`

字段映射（飞书字段名 → 扩展 JSON 字段名）已在 `config_local.py` 写好，确保飞书表里的字段名与下面一致：

**内容榜（笔记）表字段：**

- 排名
- 笔记标题
- 账号昵称
- 发布时间
- 笔记阅读数
- 笔记商品点击率
- 笔记支付转化率
- 笔记成交金额（元）
- 获取时间

**账号榜表字段：**

- 排名
- 店铺名
- 粉丝数
- 笔记阅读数
- 笔记商品点击率
- 笔记支付转化率
- 笔记成交金额（元）
- 获取时间

字段类型推荐全部用「文本」，排名可以用「数字」。

---

## 三、启动本地 Feishu API 服务

在项目根目录运行：

**Windows：**

```powershell
cd D:\MyCode\RedBook_Trend
python feishu_api.py
```

**macOS：**

```bash
cd ~/MyCode/RedBook_Trend
python3 feishu_api.py
```

看到类似：

```text
* Serving Flask app 'feishu_api'
* Running on http://127.0.0.1:8000
Press CTRL+C to quit
```

说明服务已正常启动，此终端窗口不要关闭。

---

## 四、加载浏览器扩展

1. 打开浏览器扩展管理页面：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
2. 打开右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择目录：
   - `D:\MyCode\RedBook_Trend\xhs-note-rank-extension`
4. 以后修改扩展代码后，记得在扩展页面点击一次「重新加载」。

---

## 五、日常使用流程

### 1. 打开小红书榜单页面

- 浏览器访问：
  - `https://ark.xiaohongshu.com/app-datacenter/market/note-rank`
- 等页面加载完成后，右侧会出现一个悬浮面板（采集/上传控制面板）。

### 2. 采集内容榜数据

在右侧面板「热卖榜优秀内容采集」区域：

1. 在榜单页面确认每页条数为 50 条（面板会给出提示）。
2. 点击「采集内容当前页」：
   - 会把当前页的笔记标题、账号昵称、阅读数、点击率、成交金额等解析出来；
   - 数据缓存在浏览器 `chrome.storage.local` 中。
3. 翻页后重复点击，支持多页累积。

### 3. 上传内容榜到飞书

同一块区域中：

1. 确保本地 `feishu_api.py` 服务正在运行。
2. 点击「上传内容榜到飞书」：
   - 扩展会把缓存的数据作为 JSON 发送到 `http://127.0.0.1:8000/upload_note_rank`。
   - 后端脚本使用 `upload_note_rows()` 写入 `BITABLE_NOTE_*` 所配置的多维表。
3. 上传成功后，状态栏会提示：
   - `已上传内容榜，多维表新增 N 条记录。`

### 4. 采集 & 上传账号榜数据

在右侧面板「成交榜优秀账号采集」区域：

1. 确保页面切到账号榜（成交榜）视图。
2. 点击「采集成交榜账号当前页」采集数据（店铺名、粉丝数、各项指标）。
3. 多页重复采集。
4. 点击「上传账号榜到飞书」：
   - 调用 `http://127.0.0.1:8000/upload_account_rank`；
   - 后端使用 `upload_account_rows()` 写入 `BITABLE_ACCOUNT_*` 所配置的多维表。

---

## 六、常见问题排查

- **右侧提示「无法连接本地上传服务」**
  - 检查 `feishu_api.py` 是否在运行；
  - 确认监听地址为 `127.0.0.1:8000`；
  - 若端口被占用，可修改 `config_local.API_PORT` 和后端/扩展中的端口配置。

- **飞书返回字段相关错误（FieldNameNotFound / TextFieldConvFail 等）**
  - 说明字段名或字段类型和 `config_local.py` 中的映射不匹配；
  - 在飞书中调整字段名，使之与 `FIELD_MAPPING_NOTE` / `FIELD_MAPPING_ACCOUNT` 中的中文字段一致；
  - 字段类型推荐用「文本」，排名可用「数字」。

- **修改配置不生效**
  - 修改 `config_local.py` 后需要重启 `feishu_api.py`；
  - 修改扩展代码后，需要在扩展管理页点击「重新加载」再刷新小红书页面。

---

## 七、命令速查

**Windows：**

```powershell
cd D:\MyCode\RedBook_Trend
python feishu_api.py          # 启动本地 API
python test_single_upload.py  # 手动上传一条测试数据（内容 + 账号）
```

**macOS：**

```bash
cd ~/MyCode/RedBook_Trend
python3 feishu_api.py
python3 test_single_upload.py
```

以后只要记住这三步：**改好 config_local → 跑 feishu_api → 加载扩展并在榜单页面点采集+上传**，就可以复用整个链路。

# 飞书api接口文档

## 多维表格查询接口

https://open.feishu.cn/document/docs/bitable-v1/app-table-record/search?appId=cli_a9933a6eae71500e

## app token查询 （object token）

https://open.feishu.cn/document/server-docs/docs/wiki-v2/space-node/get_node?appId=cli_a9933a6eae71500e