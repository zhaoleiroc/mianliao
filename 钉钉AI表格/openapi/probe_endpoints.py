"""
辅助脚本：探测钉钉 AI 表格的 endpoint 是否能调通

用法：
    python probe_endpoints.py
"""
import json
import sys
from client import setup_logging, DingTalkClient, DingTalkAPIError
from auth import get_access_token
from config import ENDPOINTS, get_endpoint
import logging

logger = logging.getLogger("dingtalk.probe")


def probe():
    setup_logging()
    token = get_access_token()
    client = DingTalkClient(access_token=token)

    # 待探测的 endpoint
    candidates = {
        "create_table_v1":  f"{ENDPOINTS['create_table'].rsplit('/', 1)[0]}/createTable",
        "create_table_v2":  ENDPOINTS["create_table"],
        "list_tables_v1":   ENDPOINTS["list_tables"],
        "list_fields_v1":   f"{ENDPOINTS['list_fields'].rsplit('/', 1)[0]}/fields",
    }

    print("\n探测 endpoint 可用性：\n")
    for name, url in candidates.items():
        try:
            data = client.get(url)
            print(f"✅ {name}")
            print(f"   URL: {url}")
            print(f"   response: {json.dumps(data, ensure_ascii=False)[:200]}")
        except DingTalkAPIError as e:
            print(f"⚠️  {name} [{e.code}] {e.message}")
            print(f"   URL: {url}")
        except Exception as e:
            print(f"❌ {name} - {e}")
        print()


if __name__ == "__main__":
    probe()
