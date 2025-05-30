import csv
import io
from typing import List, Dict, Any
from firebase_admin import firestore

def import_csv_responses(file_content: bytes, exam_id: str, group_id: str) -> Dict[str, Any]:
    """
    Procesa el archivo CSV y guarda las respuestas en Firestore.
    
    Args:
        file_content: Contenido del archivo CSV en bytes.
        exam_id: ID del examen.
        group_id: ID del grupo.
    
    Returns:
        Dict con el resultado de la importación.
    """
    db = firestore.client()
    
    # Leer el CSV
    csv_file = io.StringIO(file_content.decode('utf-8'))
    reader = csv.DictReader(csv_file)
    
    imported = 0
    errors = []
    
    for row in reader:
        try:
            # Extraer datos del CSV (ajustar según el formato de Google Forms)
            student_id = row.get('student_id')  # Ajustar al campo correcto
            answers = {k: v for k, v in row.items() if k != 'student_id'}
            
            # Guardar en Firestore
            attempt_ref = db.collection('usuarios').document(student_id).collection('examAttempts').document(exam_id)
            attempt_ref.set({
                'exam_id': exam_id,
                'group_id': group_id,
                'answers': answers,
                'imported_from_csv': True
            }, merge=True)
            
            imported += 1
        except Exception as e:
            errors.append(f"Error en fila {imported + 1}: {str(e)}")
    
    return {
        'imported': imported,
        'errors': errors
    } 