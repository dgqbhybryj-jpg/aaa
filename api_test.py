import os
import requests
import json

# --- 请在这里填入你的测试信息 ---
# 1. 填入你的 MiniMax API Key
# 强烈建议：不要直接写在这里，而是通过设置环境变量来使用，更安全
# 在终端运行:
# Windows: set MINIMAX_API_KEY=你的API_KEY
# Mac/Linux: export MINIMAX_API_KEY=你的API_KEY
# 如果你只是临时测试，也可以直接取消下面的注释，把Key字符串粘贴在这里
# API_KEY = "sk-..." 
API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJBbGluYSBXdSIsIlVzZXJOYW1lIjoiRW5nbGlzaCBzZW50ZW5jZSBjb2xsZWN0aW9uIHdlYnNpdGUiLCJBY2NvdW50IjoiIiwiU3ViamVjdElEIjoiMTkwNTM3Mzg0MjQ5NTI1MTAxMiIsIlBob25lIjoiIiwiR3JvdXBJRCI6IjE5MDUzNzM4NDI0OTEwNTY3MDgiLCJQYWdlTmFtZSI6IiIsIk1haWwiOiJhbGluYTgzODI3MkBnbWFpbC5jb20iLCJDcmVhdGVUaW1lIjoiMjAyNS0xMS0xNiAxMjoxMjo1MSIsIlRva2VuVHlwZSI6MSwiaXNzIjoibWluaW1heCJ9.wo72Kcbz6BQPmqrrUgejmOKjWAEQwy9snWE8AT2O66VusFZ0KQkzTS0JvigjhExfe0PDmvhshXQ6041yyt-cn6HNqOQQhXsmYKCI2hkwOekOEzx40q9xRTjSw5rt7oNZQG-9Gb_1-484FomGJBfgzmvLQx5RgpShLAEQy2V6mpByh0xF6n2GNyKiaLw9cs_8vPMjesCl8fpVoiVbXgVErKK3hjIWTYgAs7EgrWvQKI5jjgK0ICso6w51RWrbzk1tzzHuCgpp7S1njaTupeIrE1aSHe21RW0V2_zJVupCEYK-WcZXKh_wR5nUJLeVHwCfAnQ4ON9ttvUVr4yARtFniA"



# 2. 填入你要测试的 Voice ID
# 建议使用一个新创建的、7天内有效的克隆声音ID
VOICE_ID = "moss_audio_80254f50-bc80-11f0-8d50-aebac59e892f" # 这是一个示例ID，请替换成你的

# 你的 Group ID (从你的 API Key 中提取)
GROUP_ID = "1905373842491056708"

# 3. 你想用来测试的文本
TEXT_TO_SPEAK = "Hello, this is a test from the API."
# -----------------------------------------


def test_minimax_tts(api_key, voice_id, text):
    """
    一个简单的函数，用于测试 MiniMax 的文本转语音 API.
    """
    if not api_key:
        print("错误：MINIMAX_API_KEY 环境变量未设置。")
        print("请在终端设置环境变量，或者直接在脚本中填入 API_KEY。")
        return

    print("--- 开始测试 MiniMax TTS API ---")
    print(f"使用的 Voice ID: {voice_id}")
    # print(f"使用的 Group ID: {GROUP_ID}") # 新版API v2似乎不需要在URL中传递GroupId

    url = "https://api.minimax.io/v1/t2a_v2" # 使用官方文档最新的v2 API地址
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # 根据最新的v2文档，重构payload
    payload = {
        "text": text,
        "model": "speech-2.6-hd",
        "voice_setting": {
            "voice_id": voice_id,
            "speed": 1,
            "vol": 1
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)

        print(f"\n请求已发送，服务器响应状态码: {response.status_code}")
        
        content_type = response.headers.get('Content-Type', '')
        print(f"响应内容类型 (Content-Type): {content_type}")

        # 首先尝试解析JSON，因为新版API无论成功失败都返回JSON
        try:
            json_response = response.json()
            base_resp = json_response.get("base_resp", {})
            status_code = base_resp.get("status_code")
            status_msg = base_resp.get("status_msg")

            if status_code == 0 and status_msg == "success":
                # API调用成功
                print(f"\nAPI 报告成功！ (status_code: {status_code}, msg: '{status_msg}')")
                
                audio_hex = json_response.get("data", {}).get("audio")
                if audio_hex:
                    # 将十六进制字符串解码为二进制数据
                    audio_data = bytes.fromhex(audio_hex)
                    
                    output_filename = "test_output.mp3"
                    with open(output_filename, "wb") as f:
                        f.write(audio_data)
                    
                    print(f"\n测试成功！🎉")
                    print(f"音频文件已保存为: {output_filename}")
                    print("你可以播放这个文件来检查声音是否正确。")
                else:
                    print("\n测试失败 😔")
                    print("API报告成功，但响应中没有找到音频数据。")

            else:
                # API调用失败
                print("\n测试失败 😔")
                print("服务器返回了明确的错误信息。")
                print("错误详情 (JSON):")
                print(json.dumps(json_response, indent=2, ensure_ascii=False))

        except (json.JSONDecodeError, AttributeError):
            # 如果不是合法的JSON或者结构不符，按旧方式处理
            print("\n测试失败 😔")
            print("无法解析JSON格式的响应，或者响应结构不符合预期。")
            print("以下是服务器返回的原始文本内容：")
            print(response.text[:500])

    except requests.exceptions.RequestException as e:
        print(f"\n网络请求失败，发生异常: {e}")
        print("请检查你的网络连接和 API 地址是否正确。")


if __name__ == "__main__":
    test_minimax_tts(API_KEY, VOICE_ID, TEXT_TO_SPEAK)
