# analyze.py - 完全兼容 Vercel Serverless 环境
import os
import json
import traceback
from zhipuai import ZhipuAI

# 初始化智谱AI客户端（使用懒加载模式）
_client = None


def get_client():
    global _client
    if _client is None:
        try:
            api_key = os.getenv("ZHIPU_API_KEY")
            if not api_key:
                raise ValueError("ZHIPU_API_KEY 环境变量未设置")
            _client = ZhipuAI(api_key=api_key)
            print("ZhipuAI client initialized successfully")
        except Exception as e:
            print(f"初始化 ZhipuAI 客户端失败: {e}")
            _client = None
    return _client


def call_ai_for_analysis(sentence):
    """
    使用智谱AI分析英文句子
    """
    client = get_client()
    if not client:
        return {"error": "ZhipuAI client not initialized"}

    prompt = f"""
    Analyze the following English sentence: "{sentence}"

    You MUST provide the response in a valid JSON format. Do not include any text before or after the JSON object.
    The JSON object should have the following keys:

    1.  "patternAnalysis": An object with two keys:
        - "formula": A concise grammatical formula for the sentence pattern (e.g., "I'm not sure if + Subject + Verb").
        - "grammarPoint": A brief explanation of the key grammar point in Chinese.

    2.  "keyPhrases": An array of objects. Each object should have two keys: "cn" (Chinese translation) and "en" (the English phrase). Extract 3-5 important phrases. Each phrase should ideally be more than one word, unless it is a single but very important keyword. Avoid extracting simple auxiliary verbs like "is", "am", "are", "do", "does" by themselves.

    3.  "scenarioSentences": An object with keys representing different scenarios (e.g., "Daily Conversation", "Work Scenario", "Study Scenario"). The value for each key should be an array of objects, where each object has "cn" and "en" keys. Provide 2-3 examples per scenario.

    4.  "transformations": An array of objects for various sentence transformations. Each object must have three keys: "type" (e.g., "原句", "肯定句", "否定句", "疑问句", "反问句", "条件句"), "cn" (Chinese translation), and "en" (English sentence). Include the original sentence as the first item.

    Example output structure for "I'm not sure if I can make it to the party tonight.":
    {{
      "patternAnalysis": {{
        "formula": "I'm not sure if + 主语 + can + 动词",
        "grammarPoint": "'I'm not sure if' 表达不确定性，后接宾语从句说明不确定的内容。"
      }},
      "keyPhrases": [
        {{"cn": "我不确定是否", "en": "I'm not sure if"}},
        {{"cn": "能参加/赶到", "en": "can make it to"}},
        {{"cn": "今晚的派对", "en": "the party tonight"}}
      ],
      "scenarioSentences": {{
        "Daily Conversation": [
          {{"cn": "我不确定是否能按时完成项目。", "en": "I'm not sure if I can finish the project on time."}},
          {{"cn": "我不确定她是否会来参加会议。", "en": "I'm not sure if she will come to the meeting."}}
        ],
        "Work Scenario": [
          {{"cn": "我不确定客户是否会批准我们的提案。", "en": "I'm not sure if the client will approve our proposal."}}
        ]
      }},
      "transformations": [
        {{"type": "原句", "cn": "我不确定我今晚是否能参加派对。", "en": "I'm not sure if I can make it to the party tonight."}},
        {{"type": "肯定句", "cn": "我确定我今晚能参加派对。", "en": "I am sure that I can make it to the party tonight."}},
        {{"type": "疑问句", "cn": "你确定你今晚能参加派对吗？", "en": "Are you sure if you can make it to the party tonight?"}}
      ]
    }}
    """
    try:
        print(f"Sending request to ZhipuAI for sentence: {sentence}")
        response = client.chat.completions.create(
            model="glm-4",
            messages=[
                {"role": "system",
                 "content": "You are an expert English grammar teacher who provides detailed sentence analysis for Chinese learners. Your output must be a perfect JSON object following the user's specified structure, without any extra text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )

        json_str = response.choices[0].message.content
        print(f"Raw response from AI: {json_str}")

        # 清理响应，移除可能的 markdown 代码块标记
        json_str = json_str.strip()
        if json_str.startswith('```json'):
            json_str = json_str[7:]
        if json_str.endswith('```'):
            json_str = json_str[:-3]
        json_str = json_str.strip()

        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"JSON 解析错误: {e}")
        print(f"原始响应内容: {json_str}")
        return {"error": f"AI返回的数据格式错误: {str(e)}"}
    except Exception as e:
        print(f"调用智谱AI API时发生错误: {e}")
        print(traceback.format_exc())
        return {"error": f"AI服务调用失败: {str(e)}"}


def analyze_sentence(sentence):
    """
    分析句子的主函数
    """
    if not sentence or not sentence.strip():
        return {"error": "请输入有效的英文句子"}, 400

    # AI分析
    ai_results = call_ai_for_analysis(sentence.strip())

    if "error" in ai_results:
        return ai_results, 500

    # 构建最终结果
    final_result = {
        "original_sentence": sentence,
        **ai_results
    }

    return final_result, 200


# Vercel Serverless Function 入口点
def app(environ, start_response):
    """
    WSGI 兼容的应用程序接口
    """
    # 解析请求
    try:
        request_body_size = int(environ.get('CONTENT_LENGTH', 0))
    except (ValueError):
        request_body_size = 0

    request_body = environ['wsgi.input'].read(request_body_size)

    # 设置响应头
    headers = [
        ('Content-Type', 'application/json; charset=utf-8'),
        ('Access-Control-Allow-Origin', '*'),
        ('Access-Control-Allow-Methods', 'POST, OPTIONS, GET'),
        ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    ]

    # 处理预检请求
    if environ['REQUEST_METHOD'] == 'OPTIONS':
        start_response('200 OK', headers)
        return [json.dumps({'message': 'OK'}).encode('utf-8')]

    # 处理 GET 请求（健康检查）
    if environ['REQUEST_METHOD'] == 'GET':
        start_response('200 OK', headers)
        return [json.dumps({'message': 'English Analyzer API is running'}).encode('utf-8')]

    # 只处理POST请求
    if environ['REQUEST_METHOD'] != 'POST':
        start_response('405 Method Not Allowed', headers)
        return [json.dumps({'error': 'Method not allowed'}).encode('utf-8')]

    try:
        # 解析请求体
        data = json.loads(request_body.decode('utf-8'))
        sentence = data.get('sentence', '')

        # 分析句子
        result, status_code = analyze_sentence(sentence)

        start_response(f'{status_code} OK', headers)
        return [json.dumps(result, ensure_ascii=False).encode('utf-8')]

    except json.JSONDecodeError:
        start_response('400 Bad Request', headers)
        return [json.dumps({'error': 'Invalid JSON in request body'}).encode('utf-8')]
    except Exception as e:
        print(f"处理请求时发生错误: {e}")
        print(traceback.format_exc())
        start_response('500 Internal Server Error', headers)
        return [json.dumps({'error': '服务器内部错误', 'details': str(e)}).encode('utf-8')]