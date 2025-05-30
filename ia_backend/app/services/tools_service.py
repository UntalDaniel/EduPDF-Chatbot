from typing import List, Dict, Any
import google.generativeai as genai
from ..core.config import settings
from .llm import call_gemini
import json
import logging

logger = logging.getLogger(__name__)

class ToolsService:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-pro')
        
    async def generate_concept_map(self, pdf_content: str) -> Dict[str, Any]:
        try:
            prompt = f"""
            Analiza el siguiente contenido y genera un mapa conceptual:
            
            {pdf_content}
            
            Genera un mapa conceptual con:
            1. Conceptos principales (nodos tipo 'concept')
            2. Subconceptos (nodos tipo 'subconcept')
            3. Relaciones entre conceptos (edges con etiquetas)
            
            Formato de respuesta JSON:
            {{
                "nodes": [
                    {{"id": "1", "label": "Concepto Principal", "type": "concept"}},
                    {{"id": "2", "label": "Subconcepto", "type": "subconcept"}},
                    ...
                ],
                "edges": [
                    {{"id": "e1", "source": "1", "target": "2", "label": "relación"}},
                    ...
                ]
            }}
            """
            
            response = call_gemini(prompt)
            
            # Validar que la respuesta sea un JSON válido
            if isinstance(response, str):
                try:
                    response = json.loads(response)
                except json.JSONDecodeError as e:
                    logger.error(f"Error al decodificar JSON de Gemini: {e}")
                    raise ValueError("La respuesta de la IA no es un JSON válido")
            
            # Validar estructura básica
            if not isinstance(response, dict):
                raise ValueError("La respuesta debe ser un objeto")
            
            if "nodes" not in response or "edges" not in response:
                raise ValueError("La respuesta debe contener 'nodes' y 'edges'")
            
            if not isinstance(response["nodes"], list) or not isinstance(response["edges"], list):
                raise ValueError("'nodes' y 'edges' deben ser listas")
            
            return response
            
        except Exception as e:
            logger.error(f"Error al generar mapa conceptual: {str(e)}")
            raise
        
    async def generate_mind_map(self, pdf_content: str) -> Dict[str, Any]:
        try:
            prompt = f"""
            Analiza el siguiente contenido y genera un mapa mental:
            
            {pdf_content}
            
            Genera un mapa mental con:
            1. Tema central (nodo tipo 'main')
            2. Subtemas principales (nodos tipo 'subtopic')
            3. Detalles y ejemplos (nodos tipo 'detail')
            
            Formato de respuesta JSON:
            {{
                "nodes": [
                    {{"id": "1", "label": "Tema Central", "type": "main"}},
                    {{"id": "2", "label": "Subtema", "type": "subtopic"}},
                    {{"id": "3", "label": "Detalle", "type": "detail"}},
                    ...
                ],
                "edges": [
                    {{"id": "e1", "source": "1", "target": "2"}},
                    {{"id": "e2", "source": "2", "target": "3"}},
                    ...
                ]
            }}
            """
            
            response = call_gemini(prompt)
            
            # Validar que la respuesta sea un JSON válido
            if isinstance(response, str):
                try:
                    response = json.loads(response)
                except json.JSONDecodeError as e:
                    logger.error(f"Error al decodificar JSON de Gemini: {e}")
                    raise ValueError("La respuesta de la IA no es un JSON válido")
            
            # Validar estructura básica
            if not isinstance(response, dict):
                raise ValueError("La respuesta debe ser un objeto")
            
            if "nodes" not in response or "edges" not in response:
                raise ValueError("La respuesta debe contener 'nodes' y 'edges'")
            
            if not isinstance(response["nodes"], list) or not isinstance(response["edges"], list):
                raise ValueError("'nodes' y 'edges' deben ser listas")
            
            return response
            
        except Exception as e:
            logger.error(f"Error al generar mapa mental: {str(e)}")
            raise

tools_service = ToolsService() 