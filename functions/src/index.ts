// edupdf-v3-web/functions/src/index.ts

import { onRequest, Request as FirebaseV2Request } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { Response as ExpressResponse } from "express";

import axios from "axios";
import cors from "cors";

setGlobalOptions({ region: "us-central1" });

const corsHandler = cors({ origin: true });

export const callGeminiApiProxy = onRequest(
  { secrets: ["GEMINI_API_KEY_SECRET"] },
  async (request: FirebaseV2Request, response: ExpressResponse) => {
    corsHandler(request, response, async () => {
      console.log(`V2 Request received. Method: ${request.method}, Origin: ${request.headers.origin}`);
      console.log("Raw request body:", JSON.stringify(request.body));
      console.log("Type of request.body:", typeof request.body);

      const GEMINI_API_KEY = process.env.GEMINI_API_KEY_SECRET;

      if (request.method !== "POST") {
        console.warn(`Method Not Allowed: ${request.method}`);
        response.status(405).send({ data: { error: "Method Not Allowed" } });
        return;
      }

      // CORRECCIÓN AQUÍ: httpsCallable envuelve los datos en request.body.data
      const reqData = request.body.data; 

      if (typeof reqData !== 'object' || reqData === null) {
        console.error("Invalid request body structure: 'data' field is missing or not an object. Body:", JSON.stringify(request.body));
        response.status(400).send({ data: { error: "Request body must contain a 'data' object." }});
        return;
      }
      console.log("Parsed request.body.data (reqData):", JSON.stringify(reqData));


      if (!reqData.prompt || typeof reqData.prompt !== "string") {
        console.error("Invalid request: 'prompt' is missing or not a string. Prompt value:", reqData.prompt, "Type:", typeof reqData.prompt);
        response.status(400).send({ data: { error: "The 'data' object must contain a 'prompt' argument of type string." }});
        return;
      }
      if (!reqData.modelId || typeof reqData.modelId !== "string") {
        console.error("Invalid request: 'modelId' is missing or not a string. ModelId value:", reqData.modelId, "Type:", typeof reqData.modelId);
        response.status(400).send({ data: { error: "The 'data' object must contain a 'modelId' argument of type string." }});
        return;
      }

      if (!GEMINI_API_KEY) {
        console.error("Gemini API Key not found in environment variables (process.env.GEMINI_API_KEY_SECRET). Ensure the secret is set and accessible.");
        response.status(500).send({ data: { error: "Server configuration error: API Key not available." }});
        return;
      }

      const userPrompt = reqData.prompt;
      const modelId = reqData.modelId;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

      console.log(`Proxying request to Gemini API for model: ${modelId}.`);

      try {
        const payload = {
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        };
        console.log("Payload for Gemini API:", JSON.stringify(payload));

        const geminiAxiosResponse = await axios.post(apiUrl, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        });

        console.log("Gemini API response status:", geminiAxiosResponse.status);

        if (
          geminiAxiosResponse.data &&
          geminiAxiosResponse.data.candidates &&
          geminiAxiosResponse.data.candidates.length > 0 &&
          geminiAxiosResponse.data.candidates[0].content &&
          geminiAxiosResponse.data.candidates[0].content.parts &&
          geminiAxiosResponse.data.candidates[0].content.parts.length > 0 &&
          geminiAxiosResponse.data.candidates[0].content.parts[0].text
        ) {
          console.log("Successfully received and parsed response from Gemini.");
          response.status(200).send({
            data: {
              success: true,
              text: geminiAxiosResponse.data.candidates[0].content.parts[0].text,
            }
          });
        } else {
          console.warn("Unexpected response structure from Gemini API:", geminiAxiosResponse.data);
          response.status(500).send({ data: { error: "Unexpected response from the AI service." }});
        }
      } catch (error: any) {
        console.error("Error calling Gemini API from proxy:", error.message);
        if (error.response) {
          console.error("Gemini API Error Response Data:", error.response.data);
        }
        const geminiErrorMsg = error.response?.data?.error?.message || "Unknown error contacting the AI service.";
        const statusCode = typeof error.response?.status === 'number' ? error.response.status : 500;
        response.status(statusCode).send({ data: { error: `AI service error: ${geminiErrorMsg} (Status: ${statusCode})` }});
      }
    });
  }
);
