"""Code Interpreter tool for Strands Agent.

AgentCore Code Interpreter sandbox を使って Python コードを実行し、
matplotlib で生成されたグラフを S3 にアップロードして署名付き URL を返す。
"""

import base64
import json
import logging
import os
import threading
import uuid
from datetime import datetime

import boto3
from strands import tool

logger = logging.getLogger(__name__)

CODE_INTERPRETER_REGION = os.getenv("CODE_INTERPRETER_REGION", "ap-northeast-1")
OUTPUT_BUCKET = os.getenv("CODE_INTERPRETER_OUTPUT_BUCKET", "")
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-1")

# モジュールロード時に S3 クライアントを即時初期化
_s3_client = boto3.client("s3", region_name=AWS_REGION)


# ツール実行後に画像 URL を SSE ストリームへ送出するためのキュー
_pending_images: list[dict] = []
_pending_images_lock = threading.Lock()


def drain_pending_images() -> list[dict]:
    """保留中の画像URLをすべて取り出して返す"""
    with _pending_images_lock:
        images = list(_pending_images)
        _pending_images.clear()
    return images


def _upload_to_s3(img_bytes: bytes, figure_num: int) -> str | None:
    """画像を S3 にアップロードして署名付き URL を返す"""
    if not OUTPUT_BUCKET:
        logger.warning("CODE_INTERPRETER_OUTPUT_BUCKET not set, skipping S3 upload")
        return None

    try:
        s3 = _s3_client
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        key = f"outputs/{timestamp}_{uuid.uuid4().hex[:8]}_fig{figure_num}.png"

        s3.put_object(
            Bucket=OUTPUT_BUCKET,
            Key=key,
            Body=img_bytes,
            ContentType="image/png",
        )

        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": OUTPUT_BUCKET, "Key": key},
            ExpiresIn=3600,
        )
        logger.info("Uploaded image to s3://%s/%s (%.1f KB)", OUTPUT_BUCKET, key, len(img_bytes) / 1024)
        return url
    except Exception as e:
        logger.error("S3 upload failed: %s", e, exc_info=True)
        return None


@tool
def execute_python(code: str, description: str = "") -> str:
    """Execute Python code in a sandboxed environment. Use this to run data analysis,
    generate charts with matplotlib, or perform calculations.

    Available libraries: pandas, numpy, matplotlib, json, datetime.
    Use ONLY matplotlib for plotting (not seaborn).
    Use English for all chart labels and titles (Japanese fonts are not available).

    IMPORTANT for chart generation:
    - Do NOT call plt.savefig() — images are auto-captured from open figures.
    - Do NOT call plt.close() — closing figures prevents image capture.
    - Just create figures with plt.subplots() and leave them open.
    - Do NOT use boto3 — the sandbox has no AWS credentials.

    Args:
        code: Python code to execute.
        description: Optional description of what the code does.

    Returns:
        JSON string with execution results including stdout, stderr, and image URLs.
    """
    from bedrock_agentcore.tools.code_interpreter_client import code_session

    if description:
        code = f"# {description}\n{code}"

    # matplotlib の画像キャプチャコードを注入
    img_code = f"""
import matplotlib
matplotlib.use('Agg')
{code}
import matplotlib.pyplot as plt, base64, io, json as _json
_imgs = []
for _i in plt.get_fignums():
    _b = io.BytesIO()
    plt.figure(_i).savefig(_b, format='png', bbox_inches='tight', dpi=100)
    _b.seek(0)
    _imgs.append({{'i': _i, 'd': base64.b64encode(_b.read()).decode()}})
if _imgs:
    print('_IMG_' + _json.dumps(_imgs) + '_END_')
plt.close('all')
"""

    try:
        with code_session(CODE_INTERPRETER_REGION) as code_client:
            response = code_client.invoke(
                "executeCode",
                {
                    "code": img_code,
                    "language": "python",
                    "clearContext": False,
                },
            )
            result = None
            for event in response["stream"]:
                result = event["result"]

            if result is None:
                return json.dumps({
                    "isError": True,
                    "stdout": "",
                    "stderr": "No result from Code Interpreter",
                })

        stdout = result.get("structuredContent", {}).get("stdout", "")
        stderr = result.get("structuredContent", {}).get("stderr", "")
        is_error = result.get("isError", False)

        # base64 画像の抽出 → S3 アップロード → 署名付き URL をキューに追加
        image_urls = []
        clean_stdout = stdout
        if "_IMG_" in stdout and "_END_" in stdout:
            try:
                start = stdout.find("_IMG_") + 5
                end = stdout.find("_END_")
                img_json = stdout[start:end]
                imgs = json.loads(img_json)
                for img in imgs:
                    img_bytes = base64.b64decode(img["d"])
                    url = _upload_to_s3(img_bytes, img["i"])
                    if url:
                        image_urls.append(url)
                        with _pending_images_lock:
                            _pending_images.append({"url": url})
                clean_stdout = stdout[:stdout.find("_IMG_")].strip()
                logger.info("Code Interpreter generated %d image(s), uploaded %d to S3",
                            len(imgs), len(image_urls))
            except Exception as e:
                logger.warning("Failed to parse/upload image data: %s", e)

        result = {
            "isError": is_error,
            "stdout": clean_stdout,
            "stderr": stderr,
        }
        if image_urls:
            result["image_urls"] = image_urls
            result["note"] = "Images are automatically displayed to the user in the chat. Do NOT say images cannot be shown."
        return json.dumps(result, ensure_ascii=False)

    except Exception as e:
        logger.error("Code Interpreter error: %s", e, exc_info=True)
        return json.dumps({
            "isError": True,
            "stdout": "",
            "stderr": f"Code Interpreter error: {e}",
        })
