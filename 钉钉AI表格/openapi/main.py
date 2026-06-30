"""
一键跑完整流程：建表 → 建字段 → 导入数据 → 配置 AI 字段

用法：
    python main.py                     # 全流程
    python main.py --skip-create       # 跳过建表（用已有 table_id）
    python main.py --limit 5           # 只导入 5 条（测试用）
    DRY_RUN=true python main.py        # 全流程 dry-run
"""
import argparse
import sys
from pathlib import Path
from client import setup_logging
from auth import get_access_token
from ai_table import get_client, create_table, create_fields, batch_create_records
from data_loader import load_records_from_xlsx
from config import DATA_FILE, OPTIONS, TABLE_CONFIG
import logging

logger = logging.getLogger("dingtalk.main")


def main():
    setup_logging()
    parser = argparse.ArgumentParser(description="一键建表 + 导入")
    parser.add_argument("--skip-create", action="store_true", help="跳过建表，使用 .table_id")
    parser.add_argument("--limit", type=int, help="只导入前 N 条")
    parser.add_argument("--yes", "-y", action="store_true", help="跳过确认")
    args = parser.parse_args()

    print("=" * 60)
    print(" 面料推荐 · 钉钉 AI 表格 · 一键自动化")
    print("=" * 60)
    print(f"  模式：{'DRY-RUN（不真正写入）' if OPTIONS['dry_run'] else '真实执行'}")
    print(f"  表格名：{TABLE_CONFIG['name']}")
    print(f"  数据源：{DATA_FILE}")
    print("=" * 60)

    if not OPTIONS["dry_run"] and not args.yes:
        if input("\n确认执行？[y/N] ").lower() != "y":
            print("已取消")
            return

    # 1. 鉴权
    print("\n[1/4] 鉴权 ...")
    try:
        token = get_access_token()
        print(f"  ✅ token OK")
    except Exception as e:
        print(f"  ❌ 鉴权失败：{e}")
        sys.exit(1)

    client = get_client()

    # 2. 建表
    if args.skip_create:
        p = Path(__file__).parent / ".table_id"
        if not p.exists():
            print("❌ --skip-create 但 .table_id 不存在")
            sys.exit(1)
        table_id = p.read_text().strip()
        print(f"\n[2/4] 跳过建表，使用 table_id = {table_id}")
    else:
        print(f"\n[2/4] 创建 AI 表格 ...")
        resp = create_table(client)
        table_id = resp.get("tableId") or resp.get("table_id") or resp.get("id")
        if not table_id:
            print(f"  ❌ 建表失败：{resp}")
            sys.exit(1)
        Path(__file__).parent.joinpath(".table_id").write_text(table_id)
        print(f"  ✅ table_id = {table_id}")

    # 3. 建字段
    print(f"\n[3/4] 创建 25 个字段 ...")
    create_fields(client, table_id)

    # 4. 导入数据
    print(f"\n[4/4] 导入数据 ...")
    if not DATA_FILE.exists():
        print(f"  ❌ 数据文件不存在：{DATA_FILE}")
        sys.exit(1)
    records = load_records_from_xlsx(DATA_FILE)
    if args.limit:
        records = records[:args.limit]
    batch_create_records(client, table_id, records, batch_size=OPTIONS["batch_size"])

    print("\n" + "=" * 60)
    print(f" ✅ 全部完成！")
    print(f" table_id = {table_id}")
    print(f" 记录数 = {len(records)}")
    print("=" * 60)
    print(f"\n下一步：")
    print(f"  1) 钉钉工作台 → AI 表格 → 打开「{TABLE_CONFIG['name']}」核对")
    print(f"  2) python configure_ai_fields.py 打印 AI 字段 Prompt（手工配置）")
    print(f"  3) 按 02_钉钉AI表格搭建手册.md 第 5 节建 4 个视图")


if __name__ == "__main__":
    main()
