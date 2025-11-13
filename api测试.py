import requests

response = requests.post(
    "https://api.minimaxi.com/v1/get_voice",
    headers={
        "Authorization": "Bearer <token>",
        "Content-Type": "<content-type>"
    },
    data='{"voice_type": "all"}'
)
print(response.json())
url https://api.minimaxi.com/v1/get_voice \
header 'Authorization: Bearer <token>' \
header 'Content-Type: <content-type>' \
data '{"voice_type": "all"}'