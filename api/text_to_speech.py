import os
import json
import requests
import traceback

def app(environ, start_response):
    """
    WSGI 兼容的应用程序接口 for Vercel Serverless Function.
    """
    # 处理预检请求
    if environ['REQUEST_METHOD'] == 'OPTIONS':
        headers = [
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'POST, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ]
        start_response('200 OK', headers)
        return [b'']

    # 只处理POST请求
    if environ['REQUEST_METHOD'] != 'POST':
        headers = [('Content-Type', 'application/json')]
        start_response('405 Method Not Allowed', headers)
        return [json.dumps({'error': 'Method not allowed'}).encode('utf-8')]

    try:
        request_body_size = int(environ.get('CONTENT_LENGTH', 0))
    except (ValueError):
        request_body_size = 0

    request_body = environ['wsgi.input'].read(request_body_size)
    
    try:
        data = json.loads(request_body.decode('utf-8'))
        text = data.get('text')
        voice_id = data.get('voice_id')

        if not text or not voice_id:
            headers = [('Content-Type', 'application/json')]
            start_response('400 Bad Request', headers)
            return [json.dumps({'error': 'Missing text or voice_id'}).encode('utf-8')]

        # --- MiniMax API 调用 ---
        api_key = os.getenv("MINIMAX_API_KEY")
        if not api_key:
             headers = [('Content-Type', 'application/json')]
             start_response('500 Internal Server Error', headers)
             return [json.dumps({'error': 'MINIMAX_API_KEY environment variable not set'}).encode('utf-8')]
            
        url = "https://api.minimax.chat/v1/text_to_speech"
        
        headers_to_minimax = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "text": text,
            "voice_id": voice_id,
            "model": "speech-02-hd",
            "speed": 1.0
        }

        response = requests.post(url, headers=headers_to_minimax, json=payload, stream=True)

        if response.status_code == 200:
            response_headers = [
                ('Content-Type', response.headers['Content-Type']),
                ('Access-Control-Allow-Origin', '*')
            ]
            start_response('200 OK', response_headers)
            return response.iter_content(chunk_size=8192)
        else:
            error_message = response.text
            print(f"MiniMax API Error: {response.status_code} - {error_message}")
            headers = [('Content-Type', 'application/json'), ('Access-Control-Allow-Origin', '*')]
            start_response(f'{response.status_code} Bad Gateway', headers)
            return [json.dumps({'error': 'Failed to generate audio from MiniMax', 'details': error_message}).encode('utf-8')]

    except json.JSONDecodeError:
        headers = [('Content-Type', 'application/json'), ('Access-Control-Allow-Origin', '*')]
        start_response('400 Bad Request', headers)
        return [json.dumps({'error': 'Invalid JSON in request body'}).encode('utf-8')]
    except Exception as e:
        print(f"Server Error: {e}")
        print(traceback.format_exc())
        headers = [('Content-Type', 'application/json'), ('Access-Control-Allow-Origin', '*')]
        start_response('500 Internal Server Error', headers)
        return [json.dumps({'error': 'Internal Server Error', 'details': str(e)}).encode('utf-8')]
