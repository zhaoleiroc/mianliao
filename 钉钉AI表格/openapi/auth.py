"""
钉钉鉴权：获取并缓存 access_token
access_token 有效期 7200 秒，缓存到过期前 5 分钟
"""
import time
import logging
from config import CREDENTIALS, get_endpoint, validate_credentials
from client import DingTalkClient

logger = logging.getLogger("dingtalk.auth")

_cached_token: str | None = None
_token_expire_at: float = 0


def get_access_token(force_refresh: bool = False) -> str:
    """
    获取 access_token，自动缓存
    """
    global _cached_token, _token_expire_at

    # 检查缓存
    if not force_refresh and _cached_token and time.time() < _token_expire_at:
        return _cached_token

    # 校验凭证
    missing = validate_credentials()
    if missing:
        raise ValueError(
            f".env 中缺少以下凭证：{', '.join(missing)}\n"
            f"请参考 00_接入前置准备.md 配置。"
        )

    # 调用鉴权接口
    url = get_endpoint("get_access_token")
    body = {
        "appKey": CREDENTIALS["app_key"],
        "appSecret": CREDENTIALS["app_secret"],
    }
    client = DingTalkClient(access_token=None)
    logger.info("[DINGTALK] get_access_token ...")
    data = client.post(url, json_body=body, with_token=False)

    if data.get("dry_run"):
        # dry-run 模式返回一个假的 token
        _cached_token = "DRY_RUN_FAKE_TOKEN"
        _token_expire_at = time.time() + 7200
        return _cached_token

    token = data.get("accessToken") or data.get("access_token")
    expire_in = data.get("expireIn") or data.get("expire_in") or 7200
    if not token:
        raise RuntimeError(f"鉴权响应无 accessToken: {data}")

    _cached_token = token
    _token_expire_at = time.time() + int(expire_in) - 300  # 提前 5 分钟刷新
    logger.info(f"[DINGTALK] access_token OK, expires in {int(expire_in)}s")
    return _cached_token
