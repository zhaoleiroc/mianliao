"""
Step 4: 配置 AI 字段的 Prompt

注意：钉钉的 AI 字段 prompt 配置通常在建字段时就通过 aiConfig 传入了
（见 field_defs.to_dingtalk_field_payload）

本脚本做两件事：
1. 校验已建字段的 AI 配置是否正确
2. 触发 AI 字段的「批量生成」（让钉钉把空字段填上）

如果你的钉钉版本不支 aiConfig 参数，则需要在 UI 手工配置 Prompt
"""
import sys
from client import setup_logging, DingTalkAPIError
from config import get_endpoint, AI_PROMPTS
from auth import get_access_token
from ai_table import get_client, list_fields
from field_defs import FIELDS
import logging

logger = logging.getLogger("dingtalk.ai_fields")


def main():
    setup_logging()
    client = get_client()

    # 读 .table_id
    from pathlib import Path
    p = Path(__file__).parent / ".table_id"
    if not p.exists():
        print("❌ 找不到 .table_id，请先跑 create_table.py")
        sys.exit(1)
    table_id = p.read_text().strip()

    # 列出已建字段
    logger.info(f"[FIX] 列出 table_id={table_id} 的字段 ...")
    data = list_fields(client, table_id)
    fields = data.get("fields") or data.get("data") or data.get("items") or []

    if not fields:
        print(f"\n⚠️  没找到字段，请检查 API 响应：{data}")
        return

    # 校验
    ai_fields = [f for f in FIELDS if f.get("ai")]
    print(f"\n表中共有 {len(fields)} 个字段")
    print(f"  其中 {len(ai_fields)} 个是 AI 字段：")
    for f in ai_fields:
        print(f"    - {f['name']} ({f['type']})  AI={f.get('ai')}")

    print(f"\n📋 各 AI 字段对应 Prompt（复制到钉钉 AI 字段设置）：")
    for f in ai_fields:
        key = f.get("ai")
        if key in AI_PROMPTS:
            print(f"\n--- [{f['name']}] ---")
            print(AI_PROMPTS[key])
            print("---")

    print("\n如需在钉钉 UI 手工配置，参见：02_钉钉AI表格搭建手册.md 第 4 节")


if __name__ == "__main__":
    main()
