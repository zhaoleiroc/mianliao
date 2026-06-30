"""
AI 表格操作：建表、建字段、批量导入记录
所有方法都返回原始 API 响应，方便上层判断
"""
import logging
from config import get_endpoint, TABLE_CONFIG
from client import DingTalkClient
from field_defs import FIELDS, to_dingtalk_field_payload
from auth import get_access_token

logger = logging.getLogger("dingtalk.ai_table")


def get_client() -> DingTalkClient:
    """拿一个带 token 的 client"""
    return DingTalkClient(access_token=get_access_token())


# ============= 表格 =============

def create_table(client: DingTalkClient, name: str = None, description: str = None) -> dict:
    """创建 AI 表格"""
    url = get_endpoint("create_table")
    body = {
        "name": name or TABLE_CONFIG["name"],
        "description": description or TABLE_CONFIG["description"],
        "visibility": "org",  # 组织内可见
    }
    logger.info(f"[CREATE TABLE] {body['name']}")
    data = client.post(url, json_body=body)
    if data.get("dry_run"):
        # dry-run 模式：补一个假 tableId 让后续流程可以继续跑
        data["tableId"] = "DRY_TABLE_ID"
    table_id = data.get("tableId") or data.get("table_id") or data.get("id")
    if table_id:
        logger.info(f"  ✅ table_id = {table_id}")
    return data


def list_tables(client: DingTalkClient) -> dict:
    """列出所有表（用于查询已建表 ID）"""
    url = get_endpoint("list_tables")
    return client.get(url)


# ============= 字段 =============

def create_fields(client: DingTalkClient, table_id: str) -> list[dict]:
    """批量创建所有字段"""
    url = get_endpoint("create_field", table_id=table_id)
    results = []
    for f in FIELDS:
        payload = to_dingtalk_field_payload(f)
        logger.info(f"  [FIELD] {f['name']} ({f['type']})")
        resp = client.post(url, json_body=payload)
        if resp.get("dry_run"):
            resp["fieldId"] = f"DRY_FIELD_{len(results)}"
            resp["fieldName"] = f["name"]
        results.append(resp)
    logger.info(f"  ✅ 共创建 {len(results)} 个字段")
    return results


def list_fields(client: DingTalkClient, table_id: str) -> dict:
    """列出表的字段（用于核对）"""
    url = get_endpoint("list_fields", table_id=table_id)
    return client.get(url)


# ============= 记录 =============

def batch_create_records(
    client: DingTalkClient,
    table_id: str,
    records: list[dict],
    batch_size: int = 100,
) -> list[dict]:
    """
    批量创建记录
    records: [
        {
            "fields": {
                "code": "ML001",
                "name": "双面弹力摇粒绒",
                "category": "针织",
                ...
            }
        },
        ...
    ]
    """
    url = get_endpoint("batch_create_records", table_id=table_id)
    results = []
    total = len(records)
    logger.info(f"[BATCH CREATE] 共 {total} 条，每批 {batch_size} 条")

    for i in range(0, total, batch_size):
        chunk = records[i:i + batch_size]
        body = {"records": chunk}
        logger.info(f"  批次 {i // batch_size + 1}: rows {i + 1} - {min(i + batch_size, total)}")
        resp = client.post(url, json_body=body)
        if resp.get("dry_run"):
            resp["recordIds"] = [f"DRY_REC_{j}" for j in range(len(chunk))]
        results.append(resp)

    logger.info(f"  ✅ 共提交 {len(results)} 个批次")
    return results


def list_records(client: DingTalkClient, table_id: str, max_records: int = 200) -> dict:
    """列出表里的记录（验证用）"""
    url = get_endpoint("list_records", table_id=table_id)
    return client.get(url, params={"maxRecords": max_records})


def update_records(client: DingTalkClient, table_id: str, records: list[dict]) -> dict:
    """批量更新记录"""
    url = get_endpoint("batch_update_records", table_id=table_id)
    return client.post(url, json_body={"records": records})
