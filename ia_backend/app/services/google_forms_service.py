import logging
from typing import Dict, Any, Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# Inicializar el servicio de Google Forms
def get_forms_service():
    try:
        credentials = service_account.Credentials.from_service_account_file(
            settings.FIREBASE_SERVICE_ACCOUNT_KEY,
            scopes=['https://www.googleapis.com/auth/forms.body', 'https://www.googleapis.com/auth/drive']
        )
        return build('forms', 'v1', credentials=credentials), credentials
    except Exception as e:
        logger.error(f"Error inicializando el servicio de Google Forms: {e}")
        raise HTTPException(status_code=500, detail="Error al inicializar el servicio de Google Forms")

async def create_google_form(exam_data: Dict[str, Any], share_with_email: str) -> Dict[str, str]:
    """
    Crea un formulario de Google a partir de los datos del examen.
    
    Args:
        exam_data: Diccionario con los datos del examen, incluyendo título y preguntas.
        share_with_email: Correo electrónico del docente para compartir el formulario.
        
    Returns:
        Dict con el link del formulario creado.
    """
    try:
        forms_service, credentials = get_forms_service()
        
        # Crear el formulario base
        form = {
            'info': {
                'title': exam_data['title'],
                'documentTitle': exam_data['title']
            }
        }
        
        created_form = forms_service.forms().create(body=form).execute()
        form_id = created_form['formId']
        
        # Preparar las preguntas
        items = []
        for i, question in enumerate(exam_data['questions'], 1):
            if question['type'] == 'V_F':
                items.append({
                    'title': f"{i}. {question['text']}",
                    'questionItem': {
                        'question': {
                            'required': True,
                            'choiceQuestion': {
                                'type': 'RADIO',
                                'options': [
                                    {'value': 'Verdadero'},
                                    {'value': 'Falso'}
                                ],
                                'shuffle': False
                            }
                        }
                    }
                })
            elif question['type'] == 'MC':
                items.append({
                    'title': f"{i}. {question['text']}",
                    'questionItem': {
                        'question': {
                            'required': True,
                            'choiceQuestion': {
                                'type': 'RADIO',
                                'options': [{'value': opt} for opt in question['options']],
                                'shuffle': True
                            }
                        }
                    }
                })
            elif question['type'] == 'OPEN':
                items.append({
                    'title': f"{i}. {question['text']}",
                    'questionItem': {
                        'question': {
                            'required': True,
                            'textQuestion': {
                                'paragraph': True
                            }
                        }
                    }
                })
            elif question['type'] == 'FITB':
                items.append({
                    'title': f"{i}. {question['text']}",
                    'questionItem': {
                        'question': {
                            'required': True,
                            'textQuestion': {
                                'paragraph': False
                            }
                        }
                    }
                })
        
        # Actualizar el formulario con las preguntas
        forms_service.forms().batchUpdate(
            formId=form_id,
            body={'requests': [{'createItem': {'item': item, 'location': {'index': i}}} for i, item in enumerate(items)]}
        ).execute()
        
        # Compartir el formulario con el correo del docente usando la API de Google Drive
        drive_service = build('drive', 'v3', credentials=credentials)
        # El archivo de Google Form está en la carpeta raíz del Drive de la cuenta de servicio
        file_id = created_form['formId']
        try:
            drive_service.permissions().create(
                fileId=file_id,
                body={
                    'type': 'user',
                    'role': 'writer',
                    'emailAddress': share_with_email
                },
                sendNotificationEmail=True
            ).execute()
            logger.info(f"Formulario compartido con {share_with_email}")
        except Exception as e:
            logger.error(f"Error compartiendo el formulario con {share_with_email}: {e}")
            raise HTTPException(status_code=500, detail=f"Error al compartir el formulario con {share_with_email}: {str(e)}")
        
        # Obtener el link del formulario
        form_url = f"https://docs.google.com/forms/d/{form_id}/viewform"
        
        return {
            'google_form_link': form_url,
            'form_id': form_id
        }
        
    except Exception as e:
        logger.error(f"Error creando formulario de Google: {e}")
        raise HTTPException(status_code=500, detail=f"Error al crear el formulario de Google: {str(e)}") 