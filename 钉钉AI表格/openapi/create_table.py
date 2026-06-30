"""
Step 2: 创建 AI 表格 + 25 个字段
用法：
    python create_table.py                # 真实执行
    DRY_RUN=true python create_table.py  # 只打印不执行
"""
import json
import sys
from client import setup_logging, DingTalkAPIError
from auth import get_access_token
from ai_table import get_client, create_table, create_fields
from field_defs import FIELDS
import logging

logger = logging.getLogger("dingtalk.create_table")


def main():
    setup_logging()

    try:
        # 1. 建表
        client = get_client()
        table_resp = create_table(client)
        table_id = table_resp.get("tableId") or table_resp.get("table_id") or table_resp.get("id")

        if not table_id:
            print(f"\n❌ 创建表失败，未返回 table_id")
            print(f"   响应：{json.dumps(table_resp, ensure_ascii=False)[:500]}")
            sys.exit(1)

        # 2. 建字段
        logger.info(f"\n[FIX] 开始建 25 个字段 ...")
        create_fields(client, table_id)

        print(f"\n✅ 完成！")
        print(f"   table_id = {table_id}")
        print(f"\n下一步：python import_data.py --table-id {table_id}")

        # 把 table_id 写到文件，方便后续步骤读取
        with open(".table_id", "w") as f:
            f.write(table_id)

    except DingTalkAPIError as e:
        print(f"\n❌ API 错误：[{e.code}] {e.message}")
        if e.code in ("permission_denied", "Forbidden", "403"):
            print("\n   排查：到开放平台后台检查「智能表格」权限是否已开通并审批")
        elif e.code in ("InvalidApi", "NotFound", "404"):
            print("\n   排查：endpoint 可能变了，请去 https://open.dingtalk.com/document/orgapp 查最新文档")
            print("   当前 endpoint 集中在 config.py 的 ENDPOINTS 字典里")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 异常：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
