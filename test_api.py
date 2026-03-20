from google import genai
from google.genai import types

API_KEY = "AIzaSyDR67bjPBdvKjnShwLDN2aYZGrPMdH65no"

client = genai.Client(api_key=API_KEY)

# chat object maintains conversation history automatically
chat = client.chats.create(model="gemini-2.0-flash-lite")


def send_message(user_input: str) -> str:
    response = chat.send_message(user_input)
    return response.text


if __name__ == "__main__":
    print("Gemini API Test — type 'quit' to exit\n")

    while True:
        user_input = input("You: ").strip()
        if not user_input:
            continue
        if user_input.lower() == "quit":
            break

        try:
            reply = send_message(user_input)
            print(f"AI: {reply}\n")
        except Exception as e:
            print(f"Error: {e}\n")
