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
            
        # 修正1：使用官方文档指定的正确 API 地址和域名 (.io)
        url = "https://api.minimax.io/v1/chat/completions"
        
        headers_to_minimax = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # 修正2：根据官方文档，构建全新的、正确的 payload 结构
        # 我们利用 chat/completions 的能力，让它把输入的文字直接作为回复，并生成语音
        payload = {
            "model": "speech-02", # 使用文档中提到的 speech 模型
            "messages": [
                {
                    "role": "user",
                    "content": "朗读以下内容："
                },
                {
                    "role": "assistant",
                    "content": text # 将要朗读的文本放在这里
                }
            ],
            "stream": False, # 我们需要一次性获取音频，所以不用流式传输
            "speech_options": {
                # 最终修正：根据 "fail to get model info" 错误，使用一个更具体的模型名称
                "model": "speech-01-turbo-240228",
                "voice": voice_id # 指定音色 ID
            }
        }

        print(f"Calling MiniMax Chat/TTS with voice_id: {voice_id}, text: {text[:50]}...")
        
        response = requests.post(url, headers=headers_to_minimax, json=payload)

        # 关键修复：检查响应内容类型
        content_type = response.headers.get('Content-Type', '')
        print(f"MiniMax response status: {response.status_code}, content-type: {content_type}")
        
        if response.status_code == 200 and 'audio' in content_type:
            # 成功获取音频数据，直接返回二进制内容
            audio_headers = [
                ('Content-Type', content_type),
                ('Access-Control-Allow-Origin', '*'),
                ('Cache-Control', 'no-cache')
            ]
            start_response('200 OK', audio_headers)
            return [response.content]
        else:
            # MiniMax API 返回错误或非音频内容
            error_info = f"MiniMax API returned non-audio content. Status: {response.status_code}, Content-Type: {content_type}"
            print(error_info)
            # 修正3：尝试解析 JSON 格式的错误响应，以便看到 "invalid api key" 等具体信息
            try:
                error_json = response.json()
                print(f"Response JSON: {error_json}")
                preview = json.dumps(error_json)
            except json.JSONDecodeError:
                preview = response.text[:200] if response.text else 'Empty response'
                print(f"Response preview: {preview}")

            start_response('502 Bad Gateway', headers)
            return [json.dumps({
                'error': 'TTS service returned invalid response',
                'details': error_info,
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