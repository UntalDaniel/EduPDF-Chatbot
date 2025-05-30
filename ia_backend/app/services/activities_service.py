from typing import List, Dict, Any
import google.generativeai as genai
from ..core.config import settings
from .llm import call_gemini

# NUEVO: Importar la librería de crucigramas
import random
try:
    from crossword_layout_generator import Crossword
except ImportError:
    Crossword = None  # Para evitar errores si no está instalada

class ActivitiesService:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-pro')
        
    async def generate_word_search(self, pdf_content: str) -> Dict[str, Any]:
        prompt = f"""
        Analiza el siguiente contenido y genera una sopa de letras educativa:
        
        {pdf_content}
        
        Genera:
        1. Una lista de 10 palabras clave relevantes del texto
        2. Una cuadrícula de 15x15 con las palabras ocultas
        3. Pistas para encontrar cada palabra
        
        Formato de respuesta JSON:
        {{
            "words": ["palabra1", "palabra2", ...],
            "grid": [["A", "B", ...], ...],
            "hints": ["pista1", "pista2", ...]
        }}
        """
        response = call_gemini(prompt)
        # Validar y adaptar la respuesta
        words = response.get('words') if isinstance(response, dict) else None
        grid = response.get('grid') if isinstance(response, dict) else None
        hints = response.get('hints') if isinstance(response, dict) else None
        # Si no hay grid válido, generarla localmente
        if not grid or not isinstance(grid, list) or not all(isinstance(row, list) for row in grid):
            if words and isinstance(words, list) and len(words) > 0:
                grid = self._generate_word_search_grid(words, size=15)
            else:
                words = []
                grid = [['' for _ in range(15)] for _ in range(15)]
        return {
            'words': words or [],
            'grid': grid,
            'hints': hints or []
        }

    def _generate_word_search_grid(self, words, size=15):
        import random
        import string
        grid = [['' for _ in range(size)] for _ in range(size)]
        directions = [(0,1), (1,0), (1,1), (-1,1)]  # derecha, abajo, diagonal, diagonal inversa
        for word in words:
            placed = False
            attempts = 0
            word = word.upper()
            while not placed and attempts < 100:
                dir = random.choice(directions)
                if dir[0] == 0:  # horizontal
                    row = random.randint(0, size-1)
                    col = random.randint(0, size-len(word))
                elif dir[1] == 0:  # vertical
                    row = random.randint(0, size-len(word))
                    col = random.randint(0, size-1)
                else:  # diagonal
                    row = random.randint(0, size-len(word))
                    col = random.randint(0, size-len(word))
                fits = True
                for i in range(len(word)):
                    r = row + i*dir[0]
                    c = col + i*dir[1]
                    if grid[r][c] not in ('', word[i]):
                        fits = False
                        break
                if fits:
                    for i in range(len(word)):
                        r = row + i*dir[0]
                        c = col + i*dir[1]
                        grid[r][c] = word[i]
                    placed = True
                attempts += 1
        # Rellenar espacios vacíos
        for r in range(size):
            for c in range(size):
                if grid[r][c] == '':
                    grid[r][c] = random.choice(string.ascii_uppercase)
        return grid
        
    async def generate_crossword(self, pdf_content: str) -> Dict[str, Any]:
        # 1. Extraer palabras clave del texto (mejorar prompt y parsing)
        prompt = f"""
        Extrae 10 palabras clave educativas del siguiente texto.
        Responde ÚNICAMENTE con un JSON de la forma:
        {{
          "words": ["palabra1", "palabra2", ...]
        }}
        Texto:
        {pdf_content}
        """
        palabras_resp = call_gemini(prompt)
        # Validar y extraer JSON si viene con texto extra
        import json, re
        palabras = []
        if isinstance(palabras_resp, dict) and 'words' in palabras_resp:
            palabras = palabras_resp['words']
        elif isinstance(palabras_resp, str):
            # Intentar extraer JSON del string
            match = re.search(r'\{.*\}', palabras_resp, re.DOTALL)
            if match:
                try:
                    palabras_json = json.loads(match.group(0))
                    palabras = palabras_json.get('words', [])
                except Exception:
                    palabras = [w.strip() for w in palabras_resp.split(',') if w.strip()]
            else:
                palabras = [w.strip() for w in palabras_resp.split(',') if w.strip()]
        if not isinstance(palabras, list):
            palabras = []
        palabras = [p.upper() for p in palabras if len(p) > 2]
        if len(palabras) < 2:
            raise Exception('No se encontraron suficientes palabras clave para el crucigrama.')

        # 2. Generador simple de crucigramas (horizontal y vertical, sin dependencias externas)
        size = max(10, max(len(w) for w in palabras) + 2)  # tamaño mínimo 10x10
        grid = [['#' for _ in range(size)] for _ in range(size)]
        placed = []  # palabras colocadas con info
        used_numbers = set()
        number = 1

        # Colocar la primera palabra horizontal en el centro
        w0 = palabras[0]
        row = size // 2
        col = (size - len(w0)) // 2
        for i, c in enumerate(w0):
            grid[row][col + i] = c
        placed.append({'word': w0, 'row': row, 'col': col, 'direction': 'across', 'number': number})
        used_numbers.add(number)
        number += 1

        # Intentar cruzar el resto de palabras
        for w in palabras[1:]:
            placed_flag = False
            for idx, letter in enumerate(w):
                for p in placed:
                    for j, pc in enumerate(p['word']):
                        if letter == pc:
                            # Intentar colocar vertical si la palabra base es horizontal
                            if p['direction'] == 'across':
                                prow = p['row']
                                pcol = p['col'] + j
                                start_row = prow - idx
                                if start_row < 0 or start_row + len(w) > size:
                                    continue
                                # Verificar que no haya conflictos
                                conflict = False
                                for k, c in enumerate(w):
                                    r = start_row + k
                                    if grid[r][pcol] not in ('#', c):
                                        conflict = True
                                        break
                                if conflict:
                                    continue
                                # Colocar la palabra vertical
                                for k, c in enumerate(w):
                                    grid[start_row + k][pcol] = c
                                placed.append({'word': w, 'row': start_row, 'col': pcol, 'direction': 'down', 'number': number})
                                used_numbers.add(number)
                                number += 1
                                placed_flag = True
                                break
                            # Intentar colocar horizontal si la palabra base es vertical
                            elif p['direction'] == 'down':
                                prow = p['row'] + j
                                pcol = p['col']
                                start_col = pcol - idx
                                if start_col < 0 or start_col + len(w) > size:
                                    continue
                                conflict = False
                                for k, c in enumerate(w):
                                    ccol = start_col + k
                                    if grid[prow][ccol] not in ('#', c):
                                        conflict = True
                                        break
                                if conflict:
                                    continue
                                for k, c in enumerate(w):
                                    grid[prow][start_col + k] = c
                                placed.append({'word': w, 'row': prow, 'col': start_col, 'direction': 'across', 'number': number})
                                used_numbers.add(number)
                                number += 1
                                placed_flag = True
                                break
                    if placed_flag:
                        break
                if placed_flag:
                    break
            # Si no se pudo cruzar, intentar colocar horizontal en la siguiente fila vacía
            if not placed_flag:
                for r in range(size):
                    for c in range(size - len(w) + 1):
                        if all(grid[r][c + k] == '#' for k in range(len(w))):
                            for k, ch in enumerate(w):
                                grid[r][c + k] = ch
                            placed.append({'word': w, 'row': r, 'col': c, 'direction': 'across', 'number': number})
                            used_numbers.add(number)
                            number += 1
                            placed_flag = True
                            break
                    if placed_flag:
                        break
            # Si tampoco cabe, se omite

        # 3. Generar pistas descriptivas y coherentes usando Gemini
        clues = []
        for p in placed:
            # Prompt mejorado para obtener una pista descriptiva, relevante y coherente
            clue_prompt = f"""
            Eres un experto en educación. Lee el siguiente contexto extraído de un PDF educativo:
            ---
            {pdf_content}
            ---
            Genera una pista para la palabra clave "{p['word']}". La pista debe ser una definición o descripción indirecta, educativa, relevante y coherente, basada SOLO en la información del texto. No repitas la palabra en la pista ni uses sinónimos directos. Ejemplo: si la palabra es 'casa', la pista podría ser 'Lugar en donde todos vivimos'.
            Responde SOLO con la pista, sin comillas ni texto adicional.
            """
            pista = call_gemini(clue_prompt, expect_json=False)
            if isinstance(pista, dict):
                pista = list(pista.values())[0] if pista else ''
            if not isinstance(pista, str):
                pista = ''
            clues.append({
                'number': p['number'],
                'direction': p['direction'],
                'clue': pista.strip() or f"Definición de {p['word'].capitalize()}",
                'answer': p['word'],
                'row': p['row'],
                'col': p['col']
            })

        # 4. Solución (igual que grid pero sin celdas negras)
        solution = [[cell if cell != '#' else '' for cell in row] for row in grid]

        return {
            'grid': grid,
            'clues': clues,
            'solution': solution
        }
        
    async def generate_word_connection(self, pdf_content: str) -> Dict[str, Any]:
        prompt = f"""
        Eres un generador de ejercicios educativos. Analiza el siguiente texto y extrae 8 palabras clave relevantes y educativas. Para cada palabra, genera una definición o descripción clara, breve y coherente, como en un ejercicio de asociación de palabras. No repitas la palabra en la definición. Devuelve SOLO un JSON con la siguiente estructura:
        {{
            "pairs": [
                {{
                    "word": "palabra1",
                    "concept": "(puedes dejarlo igual que la palabra o como categoría si aplica)",
                    "description": "definición o descripción breve, sin repetir la palabra"
                }},
                ...
            ]
        }}
        Texto:
        {pdf_content}
        """
        
        response = call_gemini(prompt)
        # Mapeo robusto para asegurar que siempre se devuelva 'pairs' como array
        import json
        pairs = []
        if isinstance(response, dict) and 'pairs' in response:
            pairs = response['pairs']
        elif isinstance(response, dict) and 'connections' in response:
            pairs = response['connections']
        elif isinstance(response, str):
            try:
                data = json.loads(response)
                if 'pairs' in data:
                    pairs = data['pairs']
                elif 'connections' in data:
                    pairs = data['connections']
            except Exception:
                pairs = []
        # Normaliza cada par para que tenga word, concept y description
        normalized_pairs = []
        for p in pairs:
            normalized_pairs.append({
                'word': p.get('word1', p.get('word', '')),
                'concept': p.get('word2', p.get('concept', '')),
                'description': p.get('connection', p.get('descripcion', p.get('description', '')))
            })
        return { 'pairs': normalized_pairs }

activities_service = ActivitiesService() 