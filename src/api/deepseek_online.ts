import { RequestData, ResponseData } from "./deepseek";

const CHAT_URL = "https://api.deepseek.com/chat/completions";
const API_KEY = "your_api_key";
const API_SECRET = "your_api_secret";

export async function sendRequest(data: RequestData): Promise<ResponseData> {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer " + API_KEY + ":" + API_SECRET, //TODO
    },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    console.error(
      "无法发送请求:",
      resp.status,
      resp.statusText,
      await resp.text()
    );
    throw new Error("Failed to send request");
  }
  return await resp.json();
}
