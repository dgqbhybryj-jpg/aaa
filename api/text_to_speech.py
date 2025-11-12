import os
import json
import requests
import traceback
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            text = data.get('text')
            voice_id = data.get('voice_id')

            if not text or not voice_id:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Missing text or voice_id'}).encode('utf-8'))
                return

            # --- MiniMax API 调用 ---
            # 请将 YOUR_MINIMAX_API_KEY 替换为您的密钥
            api_key = os.getenv("MINIMAX_API_KEY", "YOUR_MINIMAX_API_KEY")
            
            # 官方文档中的URL，请根据您的实际情况确认
            url = "https://api.minimax.chat/v1/text_to_speech"
            
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "text": text,
                "voice_id": voice_id,
                "model": "speech-02-hd", # 您可以根据需要选择不同的模型
                "speed": 1.0
            }

            response = requests.post(url, headers=headers, json=payload, stream=True)

            if response.status_code == 200:
                self.send_response(200)
                self.send_header('Content-Type', response.headers['Content-Type'])
                self.end_headers()
                # 流式传输音频数据
                for chunk in response.iter_content(chunk_size=8192):
                    self.wfile.write(chunk)
            else:
                error_message = response.text
                print(f"MiniMax API Error: {response.status_code} - {error_message}")
                self.send_response(response.status_code)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Failed to generate audio from MiniMax', 'details': error_message}).encode('utf-8'))

        except Exception as e:
            print(f"Server Error: {e}")
            print(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Internal Server Error', 'details': str(e)}).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
