"""
Step 3: 导入 86 条面料数据
用法：
    python import_data.py                    # 用 .table_id 里的表 ID
    python import_data.py --table-id xxx     # 显式指定
    python import_data.py --source csv       # 改用 CSV 数据
"""
import argparse
import json
import sys
from pathlib import Path
from client import setup_logging, DingTalkAPIError
from config import DATA_FILE, OPTIONS
from auth import get_access_token
from ai_table import get_client, batch_create_records
from data_loader import load_records_from_xlsx, load_records_from_csv
import logging

logger = logging.getLogger("dingtalk.import")


def load_table_id(args) -> str:
    if args.table_id:
        return args.table_id
    p = Path(__file__).parent / ".table_id"
    if p.exists():
        return p.read_text().strip()
    print("❌ 找不到 table_id，请先用 create_table.py 建表，或用 --table-id 指定")
    sys.exit(1)


def main():
    setup_logging()
    parser = argparse.ArgumentParser()
    parser.add_argument("--table-id", help="AI 表格 ID")
    parser.add_argument("--source", choices=("xlsx", "csv"), default="xlsx")
    parser.add_argument("--path", help="数据文件路径，覆盖 DATA_FILE")
    parser.add_argument("--limit", type=int, help="限制导入条数（调试用）")
    args = parser.parse_args()

    table_id = load_table_id(args)
    logger.info(f"[FIX] 目标 table_id = {table_id}")

    # 加载数据
    data_path = Path(args.path) if args.path else DATA_FILE
    if args.source == "csv" or data_path.suffix.lower() == ".csv":
        records = load_records_from_csv(data_path)
    else:
        records = load_records_from_xlsx(data_path)

    if args.limit:
        records = records[:args.limit]
        logger.info(f"   限制为 {args.limit} 条（调试模式）")

    logger.info(f"[FIX] 开始导入 {len(records)} 条记录 ...")
    print(f"\n准备导入：{len(records)} 条")
    print(f"目标表 ID：{table_id}")
    print(f"数据源：{data_path}")
    if OPTIONS["dry_run"]:
        print("模式：DRY-RUN（不会真正写入）")
    if not OPTIONS["dry_run"]:
        confirm = input("确认执行？[y/N] ")
        if confirm.lower() != "y":
            print("已取消")
            return

    try:
        client = get_client()
        results = batch_create_records(client, table_id, records, batch_size=OPTIONS["batch_size"])

        print(f"\n✅ 完成")
        print(f"   共提交 {len(results)} 个批次")
        print(f"   记录数：{len(records)}")
        print(f"\n下一步：")
        print(f"   1) 在钉钉打开 AI 表格核对数据")
        print(f"   2) python configure_ai_fields.py 配置 AI 字段（如需要）")
    except DingTalkAPIError as e:
        print(f"\n❌ API 错误：[{e.code}] {e.message}")
        if e.code in ("permission_denied", "403"):
            print("   排查：检查「智能表格 - 写」权限")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 异常：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
