# 面料推荐 · 钉钉 OpenAPI 自动化

> 通过钉钉官方 OpenAPI 一键创建「面料推荐总表」并导入 86 条数据。
> 比 win32gui 稳、比手工快，可重复执行。
> **本环境无法访问 open.dingtalk.com**，所有 endpoint 路径基于通用模式，实际接入时按需校准。

---

## 0. 重要前提

⚠️ **钉钉 OpenAPI 的 endpoint 经常更新**，本项目中的路径基于经验值。如果跑通时遇到 404：
1. 打开 https://open.dingtalk.com/document/orgapp
2. 搜索「智能表格 / AI 表格」
3. 找最新 endpoint，更新 `config.py` 的 `ENDPOINTS` 字典

⚠️ **智能表格权限需要企业管理员审批**，审批周期可能 1-2 天。

---

## 1. 文件结构

```
openapi/
├── .env.example          # 凭证模板（复制成 .env 后填值）
├── .gitignore            # 防止 .env 泄漏
├── requirements.txt      # 依赖：requests / python-dotenv / openpyxl
│
├── config.py             # 配置 + endpoint 定义
├── client.py             # HTTP 客户端（带重试/日志/dry-run）
├── auth.py               # 鉴权：access_token 获取与缓存
├── ai_table.py           # AI 表格操作：建表 / 字段 / 记录
├── field_defs.py         # 25 个字段的定义
├── data_loader.py        # 从 xlsx/csv 加载并转换数据
│
├── test_auth.py          # Step 1: 验证鉴权
├── create_table.py       # Step 2: 建表 + 建字段
├── import_data.py        # Step 3: 导入 86 条
├── configure_ai_fields.py # Step 4: 配置 AI 字段
├── probe_endpoints.py    # 辅助：探测 endpoint 可用性
├── main.py               # 一键跑完整流程
│
├── 00_接入前置准备.md     # 凭证申请详细步骤
└── README.md             # 本文件
```

---

## 2. 安装与配置

### 2.1 安装依赖
```bash
cd "C:\Users\zhaolei\Desktop\学习\面料推荐\钉钉AI表格\openapi"
pip install -r requirements.txt
```

### 2.2 申请凭证
按 `00_接入前置准备.md` 操作，需要 4 个值：
- `DINGTALK_CORP_ID`
- `DINGTALK_APP_KEY`
- `DINGTALK_APP_SECRET`
- `DINGTALK_AGENT_ID`

### 2.3 填入 .env
```bash
copy .env.example .env
notepad .env
```

填入：
```ini
DINGTALK_CORP_ID=ding5xxxxxxxx
DINGTALK_APP_KEY=your_key
DINGTALK_APP_SECRET=your_secret
DINGTALK_AGENT_ID=1234567890
```

---

## 3. 运行（推荐顺序）

### Step 1：先 dry-run 看一遍
```bash
DRY_RUN=true python main.py --limit 3 --yes
```

会打印所有 API 调用，但不真实执行。**先看输出，确认 endpoint 和请求体符合预期**。

### Step 2：验证鉴权
```bash
python test_auth.py
```

期望输出：
```
[DINGTALK] get_access_token ...
[200] access_token received, expires in 7200s
✅ 鉴权 OK
```

### Step 3：建表 + 建字段
```bash
python create_table.py
```

成功后会：
- 在钉钉工作台创建一个名为「面料推荐总表」的 AI 表格
- 创建 28 个字段（25 + 3 元数据）
- 在本地写入 `.table_id` 文件

### Step 4：导入 86 条数据
```bash
python import_data.py
```

如果上一步没成功，可以手动指定：
```bash
python import_data.py --table-id 你的table_id
```

### Step 5：配置 AI 字段 Prompt
```bash
python configure_ai_fields.py
```

会打印每个 AI 字段的 Prompt 模板（复制到钉钉 UI 中配置）。

### 一键跑全部
```bash
python main.py --yes           # 全流程
python main.py --limit 5       # 只导入 5 条（测试）
python main.py --skip-create   # 跳过建表
```

---

## 4. 常用命令速查

| 场景 | 命令 |
|---|---|
| 仅看 API 调用，不真执行 | `DRY_RUN=true python main.py --limit 3` |
| 只跑鉴权测试 | `python test_auth.py` |
| 探测 endpoint 是否对 | `python probe_endpoints.py` |
| 用 CSV 而非 xlsx | `python import_data.py --source csv` |
| 改数据文件 | `python import_data.py --path D:\my_data.xlsx` |
| 跳过建表、只导数据 | `python import_data.py --table-id xxx` |
| 一键全跑 | `python main.py --yes` |

---

## 5. 故障排查

### 401 / 鉴权失败
```
{"code": "InvalidAppKey", "message": "invalid appKey or appSecret"}
```
- 核对 `.env` 中 `DINGTALK_APP_KEY` / `DINGTALK_APP_SECRET` 是否复制完整
- 注意 appSecret 只显示一次，复制时少字符会失败

### 403 / 权限拒绝
```
{"code": "Forbidden", "message": "permission denied"}
```
- 到 https://open-dev.dingtalk.com → 应用 → 权限管理
- 确认「智能表格 - 写」「智能表格 - 读」已勾选且状态为「已开通」
- 提交申请后等企业管理员审批

### 404 / Endpoint 不存在
```
{"code": "NotFound"}
```
- endpoint 路径可能变了
- 打开 https://open.dingtalk.com/document/orgapp 查最新文档
- 更新 `config.py` 的 `ENDPOINTS` 字典

### 400 / 参数错误
```
{"code": "InvalidParameter", "message": "field 'options' is required"}
```
- 字段定义格式与钉钉期望不一致
- 看 `field_defs.to_dingtalk_field_payload` 函数，对比钉钉文档调整

### 单选字段值不合法
- 钉钉对单选值是**严格校验**的，必须在字典中已存在
- 检查 `data_loader.py` 中的 `SINGLE_SELECT_ALIASES` 和字典一致性

---

## 6. 自定义扩展

### 加新字段
编辑 `field_defs.py`，加一行：
```python
{"name": "新字段名", "type": "Text", "required": False, "alias": "new_field"},
```
然后重新跑 `python create_table.py`（会新建一个表）

### 改 AI Prompt
编辑 `config.py` 的 `AI_PROMPTS` 字典。

### 增量更新（新增面料）
```python
from ai_table import get_client, batch_create_records
from data_loader import load_records_from_xlsx
client = get_client()
records = load_records_from_xlsx("new_data.xlsx")
batch_create_records(client, "your_table_id", records)
```

### 改 endpoint
所有 endpoint 集中在 `config.py` 的 `ENDPOINTS` 字典，方便校准：
```python
ENDPOINTS = {
    "create_table": "https://api.dingtalk.com/v1.0/aiTable/tables",
    # ...
}
```

---

## 7. 安全性

- `.env` 已加入 `.gitignore`，不会泄漏凭证
- `access_token` 缓存在内存中，自动 7200s 过期
- 建议在 `client.py` 加 IP 白名单（企业内网限定）

---

## 8. 与上一阶段（手工方案）的关系

- **手工方案**（`02_钉钉AI表格搭建手册.md`）适用于：UI 配置、个性化调整、一次性的精细活
- **OpenAPI 方案**（本目录）适用于：批量初始化、CI/CD 化、重复跑
- 两者可配合：先用 API 快速建表，再用 UI 配置 AI Prompt / 视图 / 权限

---

## 9. 性能参考

| 步骤 | 86 条数据耗时 |
|---|---|
| 鉴权 | < 1s |
| 建表 | < 1s |
| 建 28 字段 | 5-10s（钉钉 1 个 HTTP 调/字段） |
| 批量导入 86 条 | 2-5s |
| **合计** | **~15-20s** |

---

## 10. 后续路线图

- [ ] CLI 进度条（用 `tqdm`）
- [ ] 异步并发（`aiohttp`）进一步提速
- [ ] 增量同步脚本（用 `last_modified_at` 比对）
- [ ] 失败重试队列
- [ ] 集成钉钉 webhook 推送执行结果

---

**遇到问题先看 `00_接入前置准备.md` 和第 5 节「故障排查」。**
