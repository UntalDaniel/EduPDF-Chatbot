import google.generativeai as genai
import os
import re
import json

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY_BACKEND", "TU_API_KEY_DE_GEMINI")
genai.configure(api_key=GEMINI_API_KEY)

def call_gemini(prompt: str, model: str = "gemini-1.5-flash-latest", max_tokens: int = 2048, expect_json: bool = True) -> dict | str:
    try:
        model_instance = genai.GenerativeModel(model)
        response = model_instance.generate_content(
            prompt,
            generation_config={
                "max_output_tokens": max_tokens,
                "temperature": 0.2,
            }
        )
        # El texto generado puede estar en response.text o en response.candidates[0].content.parts[0].text
        result_text = getattr(response, "text", None)
        if not result_text and hasattr(response, "candidates"):
            # Fallback para otras versiones
            result_text = response.candidates[0].content.parts[0].text
        if expect_json:
            match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            else:
                raise ValueError("No se encontró JSON en la respuesta de Gemini")
        else:
            return result_text.strip()
    except Exception as e:
        print(f"Error llamando a Gemini: {e}")
        return {"error": str(e)} 