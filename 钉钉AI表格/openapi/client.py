"""
通用 HTTP 客户端：带重试、自动加 token、详细日志
"""
import json
import time
import logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from config import OPTIONS, CREDENTIALS

logger = logging.getLogger("dingtalk")


class DingTalkClient:
    """封装钉钉 API 调用"""

    def __init__(self, access_token: str | None = None):
        self.access_token = access_token
        self.session = self._build_session()
        self.dry_run = OPTIONS["dry_run"]
        self.timeout = OPTIONS["timeout"]

    def _build_session(self) -> requests.Session:
        s = requests.Session()
        retry = Retry(
            total=OPTIONS["retries"],
            backoff_factor=0.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET", "POST", "PUT", "DELETE", "PATCH"),
        )
        s.mount("https://", HTTPAdapter(max_retries=retry))
        s.mount("http://", HTTPAdapter(max_retries=retry))
        return s

    # ---------- 底层请求 ----------
    def request(self, method: str, url: str, *, json_body=None, params=None,
                with_token: bool = True) -> dict:
        """
        统一请求入口
        - with_token=True 自动加 x-acs-dingtalk-access-token 头（新接口）
        - 旧 oapi 接口自动用 access_token 查询参数
        """
        headers = {"Content-Type": "application/json"}
        if with_token and self.access_token:
            if "oapi.dingtalk.com" in url:
                params = params or {}
                params["access_token"] = self.access_token
            else:
                headers["x-acs-dingtalk-access-token"] = self.access_token

        if self.dry_run:
            logger.info(f"[DRY-RUN] {method} {url}")
            logger.info(f"  headers: {headers}")
            if params:
                logger.info(f"  params: {params}")
            if json_body is not None:
                logger.info(f"  body: {json.dumps(json_body, ensure_ascii=False)[:500]}")
            return {"dry_run": True, "method": method, "url": url}

        if OPTIONS["verbose"]:
            logger.debug(f">>> {method} {url}")
            if json_body:
                logger.debug(f"    body: {json.dumps(json_body, ensure_ascii=False)[:300]}")

        try:
            resp = self.session.request(
                method, url,
                json=json_body,
                params=params,
                headers=headers,
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            logger.error(f"[NETWORK ERROR] {method} {url} -> {e}")
            raise

        if OPTIONS["verbose"]:
            logger.debug(f"<<< {resp.status_code} {resp.text[:300]}")

        # 解析响应
        try:
            data = resp.json()
        except ValueError:
            logger.error(f"[NON-JSON RESPONSE] {resp.status_code} {resp.text[:500]}")
            resp.raise_for_status()
            return {}

        # 钉钉统一错误格式
        if isinstance(data, dict):
            # 新版 API 用 topLevelCode / requestId
            if "code" in data and data["code"] not in (0, "0", None, ""):
                self._log_error(data, method, url, resp.status_code)
                raise DingTalkAPIError(data)
            if "errcode" in data and data["errcode"] not in (0, "0", None, ""):
                self._log_error(data, method, url, resp.status_code)
                raise DingTalkAPIError(data, legacy=True)

        return data

    def _log_error(self, data, method, url, status):
        code = data.get("code") or data.get("errcode")
        msg = data.get("message") or data.get("errmsg") or "(no message)"
        request_id = data.get("requestid") or data.get("requestId") or ""
        logger.error(f"[API ERROR {code}] {method} {url}")
        logger.error(f"  message: {msg}")
        if request_id:
            logger.error(f"  requestId: {request_id}")
        logger.error(f"  http status: {status}")

    # ---------- 便捷方法 ----------
    def get(self, url, params=None, with_token=True):
        return self.request("GET", url, params=params, with_token=with_token)

    def post(self, url, json_body=None, params=None, with_token=True):
        return self.request("POST", url, json_body=json_body, params=params, with_token=with_token)

    def put(self, url, json_body=None, params=None, with_token=True):
        return self.request("PUT", url, json_body=json_body, params=params, with_token=with_token)

    def patch(self, url, json_body=None, params=None, with_token=True):
        return self.request("PATCH", url, json_body=json_body, params=params, with_token=with_token)

    def delete(self, url, params=None, with_token=True):
        return self.request("DELETE", url, params=params, with_token=with_token)


class DingTalkAPIError(Exception):
    """钉钉 API 业务错误"""

    def __init__(self, data: dict, legacy: bool = False):
        self.data = data
        self.legacy = legacy
        if legacy:
            self.code = data.get("errcode")
            self.message = data.get("errmsg", "")
        else:
            self.code = data.get("code") or data.get("errcode")
            self.message = data.get("message") or data.get("errmsg", "")
        super().__init__(f"[{self.code}] {self.message}")


def setup_logging(level=logging.INFO):
    """统一日志格式"""
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        datefmt="%H:%M:%S",
    )
