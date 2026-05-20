import OpenAI from "openai";

const aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default aiClient;