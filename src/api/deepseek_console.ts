import { RequestData, ResponseData } from "./deepseek";

export async function sendRequest(data: RequestData): Promise<ResponseData> {
  const msgs = data.messages
    .map(({ role, content }) => `<${role}>\n${content}\n</${role}>\n`)
    .join("\n");
  console.log(msgs);
  throw new Error("Not implemented");
}
