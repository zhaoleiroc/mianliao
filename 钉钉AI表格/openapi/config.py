"""
配置加载 + 端点定义
所有 endpoint 都集中在这里，方便根据钉钉开放平台最新文档校准
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env（位于本文件同目录）
ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(ENV_PATH)


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes", "y")


# ===== 凭证 =====
CREDENTIALS = {
    "corp_id":     os.getenv("DINGTALK_CORP_ID", ""),
    "app_key":     os.getenv("DINGTALK_APP_KEY", ""),
    "app_secret":  os.getenv("DINGTALK_APP_SECRET", ""),
    "agent_id":    os.getenv("DINGTALK_AGENT_ID", ""),
}

# ===== 运行选项 =====
OPTIONS = {
    "dry_run":    _bool("DRY_RUN", False),
    "verbose":    _bool("VERBOSE", False),
    "timeout":    int(os.getenv("HTTP_TIMEOUT", "30")),
    "retries":    int(os.getenv("HTTP_RETRIES", "3")),
    "batch_size": int(os.getenv("BATCH_SIZE", "100")),
}

# ===== 路径 =====
BASE_DIR = Path(__file__).parent
DATA_FILE = BASE_DIR / os.getenv("DATA_FILE", "../面料推荐_预转数据_86条.xlsx")

# ===== 表格配置 =====
TABLE_CONFIG = {
    "name": os.getenv("TABLE_NAME", "面料推荐总表"),
    "description": os.getenv("TABLE_DESCRIPTION", "工厂/打样师参考用"),
}

# ===== 钉钉 API 端点 =====
# 重要：钉钉 API 经常更新，path 可能有变
# 如发现 404，可去 https://open.dingtalk.com/document/orgapp 查最新文档
BASE_URL = "https://api.dingtalk.com"
LEGACY_OAPI = "https://oapi.dingtalk.com"

ENDPOINTS = {
    # 鉴权
    "get_access_token":  f"{BASE_URL}/v1.0/oauth2/accessToken",

    # ===== AI 表格 / 智能表格 =====
    # 旧版路径（兼容）
    "create_table":      f"{BASE_URL}/v1.0/aiTable/tables",
    "list_tables":       f"{BASE_URL}/v1.0/aiTable/tables",
    "get_table":         f"{BASE_URL}/v1.0/aiTable/tables/{{table_id}}",

    # 字段
    "create_field":      f"{BASE_URL}/v1.0/aiTable/tables/{{table_id}}/fields",
    "list_fields":       f"{BASE_URL}/v1.0/aiTable/tables/{{table_id}}/fields",
    "update_field":      f"{BASE_URL}/v1.0/aiTable/tables/{{table_id}}/fields/{{field_id}}",

    # 记录
    "batch_create_records":  f"{BASE_URL}/v1.0/aiTable/tables/{{table_id}}/records/batchCreate",
    "batch_update_records":  f"{BASE_URL}/v1.0/aiTable/tables/{{table_id}}/records/batchUpdate",
    "list_records":          f"{BASE_URL}/v1.0/aiTable/tables/{{table_id}}/records",
    "delete_records":        f"{BASE_URL}/v1.0/aiTable/tables/{{table_id}}/records/batchDelete",
}

# ===== AI 字段 prompt 模板 =====
# 卖点和智能补全都用这里定义
AI_PROMPTS = {
    "smart_fill_composition": (
        "根据面料名称「{name}」和品类「{category}」，"
        "推断该面料的典型成分配比（百分比）。"
        "返回格式示例：94%涤纶 + 6%氨纶。"
        "如果无法推断，返回空字符串。"
    ),
    "smart_fill_weight": (
        "根据面料名称「{name}」和品类「{category}」，"
        "推断该面料的克重范围（g/㎡）。"
        "只返回一个数字（克重中位数），如 280。"
        "如果无法推断，返回 0。"
    ),
    "auto_selling_points": (
        "你是一位资深面料销售，请根据以下面料信息写一段 30-80 字的"
        "工厂/打样师视角推荐话术。\n"
        "要求：1) 突出适用场景和工艺要点；"
        "2) 提到至少 1 个替代关系或升级点；"
        "3) 语气专业、简洁；4) 不超过 80 字；5) 中文。\n\n"
        "面料名称：{name}\n"
        "品类：{category}\n"
        "成分：{composition}\n"
        "克重：{weight} g/㎡\n"
        "幅宽：{width} cm\n"
        "适用季节：{season}\n"
        "推荐款式：{styles}\n"
        "特性：{features}\n"
    ),
    "image_recognize": (
        "请识别这张面料图片，输出 JSON：\n"
        '{"成分": "...", "克重": 0, "结构": "..."}\n'
        "如果图片模糊无法判断，对应字段返回 null。"
    ),
}


def validate_credentials() -> list[str]:
    """返回缺失的凭证字段列表（用于友好报错）"""
    return [k for k, v in CREDENTIALS.items() if not v]


def get_endpoint(name: str, **params) -> str:
    """根据名称取 endpoint，params 用于填充 path 占位符"""
    if name not in ENDPOINTS:
        raise KeyError(f"未定义的 endpoint: {name}")
    url = ENDPOINTS[name]
    for k, v in params.items():
        url = url.replace("{" + k + "}", str(v))
    return url
