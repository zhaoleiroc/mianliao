"""
Step 1: 验证鉴权是否就绪
用法：
    python test_auth.py
"""
import sys
from client import setup_logging
from auth import get_access_token
from config import validate_credentials


def main():
    setup_logging()

    # 检查凭证
    missing = validate_credentials()
    if missing:
        print("\n❌ .env 中缺少以下凭证：")
        for m in missing:
            print(f"   - {m}")
        print("\n请参考 00_接入前置准备.md 配置 .env 文件")
        sys.exit(1)

    # 尝试获取 token
    try:
        token = get_access_token()
        print(f"\n✅ 鉴权 OK")
        print(f"   access_token: {token[:20]}...")
    except Exception as e:
        print(f"\n❌ 鉴权失败：{e}")
        print("\n排查步骤：")
        print("  1) 确认 .env 中 4 个凭证都填了")
        print("  2) 在 https://open-dev.dingtalk.com 确认应用已创建")
        print("  3) 在「权限管理」确认「智能表格」权限已开通")
        print("  4) 如果是企业管理员审批类权限，确认已审批通过")
        sys.exit(1)


if __name__ == "__main__":
    main()
