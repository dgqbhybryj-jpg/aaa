# text_to_speech.py - 完整修复版本
import os
import json
import requests
import traceback

def app(environ, start_response):
    """
    WSGI 兼容的应用程序接口 for Vercel Serverless Function.
    """
    # 设置通用 headers
    headers = [
        ('Content-Type', 'application/json'),
        ('Access-Control-Allow-Origin', '*'),
        ('Access-Control-Allow-Methods', 'POST, OPTIONS, GET'),
        ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    ]

    # 处理预检请求
    if environ['REQUEST_METHOD'] == 'OPTIONS':
        start_response('200 OK', headers)
        return [b'']

    # 只处理POST请求
    if environ['REQUEST_METHOD'] != 'POST':
        start_response('405 Method Not Allowed', headers)
        return [json.dumps({'error': 'Method not allowed'}).encode('utf-8')]

    try:
        # 获取请求体大小
        try:
            request_body_size = int(environ.get('CONTENT_LENGTH', 0))
        except (ValueError):
            request_body_size = 0

        request_body = environ['wsgi.input'].read(request_body_size)
        
        # 解析请求数据
        data = json.loads(request_body.decode('utf-8'))
        text = data.get('text', '').strip()
        voice_id = data.get('voice_id', '').strip()

        if not text:
            start_response('400 Bad Request', headers)
            return [json.dumps({'error': 'Missing text parameter'}).encode('utf-8')]

        if not voice_id:
            start_response('400 Bad Request', headers)
            return [json.dumps({'error': 'Missing voice_id parameter'}).encode('utf-8')]

        # --- MiniMax API 调用 ---
        api_key = os.getenv("MINIMAX_API_KEY")

        if not api_key:
            start_response('500 Internal Server Error', headers)
            error_msg = 'MINIMAX_API_KEY environment variable must be set'
            return [json.dumps({'error': error_msg}).encode('utf-8')]
            
        # 使用在 api_test.py 中验证成功的最新 v2 API 地址
        url = "https://api.minimax.io/v1/t2a_v2"
        
        headers_to_minimax = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # 使用最新的 v2 API 数据格式
        payload = {
            "text": text,
            "model": "speech-2.6-hd",
            "voice_setting": {
                "voice_id": voice_id,
                "speed": 1,
                "vol": 1
            }
        }

        print(f"Calling MiniMax TTS v2 with voice_id: {voice_id}, text: {text[:50]}...")
        
        response = requests.post(url, headers=headers_to_minimax, json=payload)

        # 检查响应并处理返回的 JSON 数据
        print(f"MiniMax response status: {response.status_code}")
        
        try:
            json_response = response.json()
            base_resp = json_response.get("base_resp", {})
            status_code = base_resp.get("status_code")
            
            if status_code == 0:
                # API 调用成功，解码十六进制音频数据
                audio_hex = json_response.get("data", {}).get("audio")
                if audio_hex:
                    audio_data = bytes.fromhex(audio_hex)
                    audio_headers = [
                        ('Content-Type', 'audio/mpeg'), # 通常是 mp3
                        ('Access-Control-Allow-Origin', '*'),
                        ('Cache-Control', 'no-cache')
                    ]
                    start_response('200 OK', audio_headers)
                    return [audio_data]
                else:
                    raise ValueError("API success but no audio data found")
            else:
                # API 返回明确的错误
                error_msg = base_resp.get("status_msg", "Unknown error")
                raise ValueError(f"MiniMax API Error: {error_msg} (Code: {status_code})")

        except (json.JSONDecodeError, ValueError, AttributeError) as api_error:
            print(f"Failed to process MiniMax response: {api_error}")
            try:
                # 尝试打印原始响应以供调试
                preview = response.text[:200]
                print(f"Response preview: {preview}")
            except Exception:
                preview = "Could not get response preview."

            start_response('502 Bad Gateway', headers)
            return [json.dumps({
                'error': 'TTS service returned an invalid response.',
                'details': str(api_error),
                'response_preview': preview
            }).encode('utf-8')]

    except json.JSONDecodeError:
        start_response('400 Bad Request', headers)
        return [json.dumps({'error': 'Invalid JSON in request body'}).encode('utf-8')]
    except Exception as e:
        print(f"Server Error: {e}")
        print(traceback.format_exc())
        start_response('500 Internal Server Error', headers)
        return [json.dumps({
            'error': 'Internal Server Error', 
            'details': str(e)
        }).encode('utf-8')]