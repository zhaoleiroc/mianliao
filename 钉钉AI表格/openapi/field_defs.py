"""
25 个字段的定义
按钉钉 AI 表格的字段类型描述来写
如果钉钉实际类型不匹配（比如 SingleSelect 实际叫 SingleSelectField），
只需改这里的 type 字段即可
"""

# 字段定义：
#   name: 字段名（中文）
#   type: 钉钉类型 (text/number/singleSelect/multiSelect/date/attachment/...)
#   required: 是否必填
#   options: 单选/多选的选项列表
#   ai: 是否 AI 字段，None 表示非 AI
#   prompt_key: 对应 config.AI_PROMPTS 的 key
#   alias: 别名（钉钉某些接口需要英文 alias）

# 钉钉 AI 表格可能支持的 type（按经验值）
# - Text             文本
# - Number           数字
# - SingleSelect     单选
# - MultiSelect      多选
# - Date             日期
# - DateTime         日期时间
# - Attachment       附件
# - Url              链接
# - Checkbox         复选框
# - User             人员
# - Department       部门
# - Location         地址
# - Formula          公式
# - AutoNumber       自动编号
# - Currency         货币
# - Percent          百分比
# - Phone            电话
# - Email            邮箱

FIELDS = [
    # ----- 基础信息 -----
    {"name": "面料编号",   "type": "Text",         "required": True,  "alias": "code",
     "desc": "内部唯一编号/货号"},
    {"name": "面料名称",   "type": "Text",         "required": True,  "alias": "name",
     "desc": "中文品名", "ai": "smart_fill"},
    {"name": "面料图片",   "type": "Attachment",   "required": False, "alias": "image",
     "desc": "拍实物图，AI 自动识别成分/克重", "ai": "image_recognize"},
    {"name": "品类",       "type": "SingleSelect", "required": True,  "alias": "category",
     "options": ["针织", "机织", "PU 绒", "家纺"]},
    {"name": "供应商",     "type": "SingleSelect", "required": True,  "alias": "supplier",
     "options": ["常熟市华瑞针纺织", "中涛 / 三时", "万泰", "home_fr", "3S AVVA"]},

    # ----- 成分 -----
    {"name": "成分描述",   "type": "Text",         "required": True,  "alias": "composition",
     "desc": "如：94%涤纶 + 6%氨纶",
     "ai": "smart_fill_composition"},
    {"name": "涤纶 %",     "type": "Number",       "required": False, "alias": "polyester_pct"},
    {"name": "棉 %",       "type": "Number",       "required": False, "alias": "cotton_pct"},
    {"name": "氨纶 %",     "type": "Number",       "required": False, "alias": "spandex_pct"},
    {"name": "再生纤维 %", "type": "Number",       "required": False, "alias": "recycled_pct"},
    {"name": "其他成分",   "type": "Text",         "required": False, "alias": "other_composition"},

    # ----- 规格 -----
    {"name": "幅宽 cm",    "type": "Number",       "required": False, "alias": "width_cm",
     "ai": "smart_fill"},
    {"name": "克重 g/㎡",  "type": "Number",       "required": True,  "alias": "weight_gsm",
     "ai": "smart_fill_weight"},
    {"name": "结构/织法",  "type": "SingleSelect", "required": False, "alias": "structure",
     "options": ["纬编针织", "经编针织", "平纹", "斜纹", "缎纹", "提花", "灯芯绒", "摇粒绒复合", "PU 涂层"]},
    {"name": "后整理",     "type": "MultiSelect",  "required": False, "alias": "finish",
     "options": ["磨毛", "压花", "烫金", "烫银", "印花", "PU 涂层", "防水涂层", "抗静电", "抗菌", "阻燃处理"]},
    {"name": "阻燃等级",   "type": "Text",         "required": False, "alias": "fr_standard",
     "desc": "如：NFPA 701 / EN 13501-1"},

    # ----- 价格 -----
    {"name": "RMB 价格 元/m", "type": "Number",    "required": False, "alias": "price_rmb_per_m"},
    {"name": "FOB 价格 USD/m","type": "Number",    "required": False, "alias": "price_fob_usd_per_m"},
    {"name": "起订量 MOQ",    "type": "Number",    "required": False, "alias": "moq"},

    # ----- 推荐维度（AI 推断） -----
    {"name": "适用季节",   "type": "MultiSelect",  "required": True,  "alias": "season",
     "options": ["春", "夏", "秋", "冬", "四季"]},
    {"name": "推荐款式",   "type": "MultiSelect",  "required": True,  "alias": "applications",
     "options": ["外套", "T 恤", "卫衣", "衬衫", "夹克/夹棉", "家居服", "运动服", "童装", "内裤", "家纺床品", "家纺窗帘", "马甲", "工装裤", "Polo 衫"]},
    {"name": "特性标签",   "type": "MultiSelect",  "required": False, "alias": "features",
     "options": ["保暖", "透气", "弹力", "亲肤", "挺括", "垂感", "抗皱", "抗起球", "防水", "阻燃", "再生环保", "复古"]},

    # ----- AI 文案 -----
    {"name": "卖点文案",   "type": "Text",         "required": False, "alias": "selling_points",
     "ai": "auto_selling_points", "desc": "AI 自动生成 30-80 字推荐话术"},
    {"name": "相似款链接", "type": "Url",          "required": False, "alias": "similar_links"},

    # ----- 备注 -----
    {"name": "备注",       "type": "Text",         "required": False, "alias": "remark"},

    # ----- 隐藏元数据 -----
    {"name": "__来源文件", "type": "Text",         "required": False, "alias": "source_file", "hidden": True},
    {"name": "__来源行号", "type": "Number",       "required": False, "alias": "source_row",  "hidden": True},
    {"name": "__导入时间", "type": "DateTime",     "required": False, "alias": "imported_at", "hidden": True},
]


def to_dingtalk_field_payload(field_def: dict) -> dict:
    """
    把内部定义转成钉钉 API 请求体
    钉钉的实际字段名可能是 fieldName / name / fieldNameEn，
    这里按经验写最常见的，如果不对改这里即可
    """
    payload = {
        "fieldName": field_def["name"],
        "fieldNameEn": field_def.get("alias", ""),
        "fieldType": field_def["type"],
        "required": field_def.get("required", False),
        "description": field_def.get("desc", ""),
    }
    if "options" in field_def:
        payload["options"] = [
            {"name": opt, "value": opt, "color": ""} for opt in field_def["options"]
        ]
    if field_def.get("ai"):
        payload["aiConfig"] = {
            "enabled": True,
            "aiType": _map_ai_type(field_def["ai"]),
            "promptKey": field_def["ai"],
        }
    if field_def.get("hidden"):
        payload["hidden"] = True
    return payload


def _map_ai_type(ai_key: str) -> str:
    """AI 类型映射"""
    if ai_key.startswith("smart_fill"):
        return "SmartFill"
    if ai_key == "auto_selling_points":
        return "TextGeneration"
    if ai_key == "image_recognize":
        return "ImageUnderstanding"
    return "Unknown"
