import { ActivityType, type ActivityTypeActivity } from '../types/activityTypes';
import { generateWordSearch, generateCrossword, generateWordConnection } from './aiService';
import { createActivity as createFirestoreActivity } from '../firebase/activityService';
import { generateActivityPdf } from '../utils/pdfGenerator';

// Error class for activity-related errors
class ActivityError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ActivityError';
  }
}

const validatePdfId = (pdfId: string): void => {
  if (!pdfId || typeof pdfId !== 'string' || pdfId.trim() === '' || pdfId === 'temp') {
    throw new ActivityError('ID de PDF no válido', 'INVALID_PDF_ID', { pdfId });
  }
};

export const createNewActivity = async (
  type: ActivityType,
  pdfId: string,
  userId: string,
  title: string = 'Nueva Actividad',
  description: string = ''
): Promise<ActivityTypeActivity> => {
  try {
    validatePdfId(pdfId);
    
    let activityData;
    
    // Generate activity based on type
    switch (type) {
      case ActivityType.WORD_SEARCH:
        activityData = await generateWordSearch(pdfId);
        break;
      case ActivityType.CROSSWORD:
        activityData = await generateCrossword(pdfId);
        break;
      case ActivityType.WORD_CONNECTION:
        activityData = await generateWordConnection(pdfId);
        break;
      default:
        throw new ActivityError('Tipo de actividad no válido', 'INVALID_ACTIVITY_TYPE');
    }
    
    // Create activity object with proper typing
    const now = new Date();
    const newActivity: Omit<ActivityTypeActivity, 'id'> = {
      type,
      title,
      description,
      data: activityData,
      pdfId,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    // Save to Firestore
    const activityId = await saveActivity(newActivity);
    
    return { ...newActivity, id: activityId } as ActivityTypeActivity;
  } catch (error) {
    console.error('Error creating new activity:', error);
    throw error instanceof ActivityError 
      ? error 
      : new ActivityError('Error al crear la actividad', 'ACTIVITY_CREATION_ERROR', { cause: error });
  }
};

// Single validateActivity function with all validations
const validateActivity = (activity: Omit<ActivityTypeActivity, 'id'>, isForPdf: boolean = false): string[] => {
  const errors: string[] = [];
  
  if (!activity.type) {
    errors.push('El tipo de actividad es requerido');
  }
  
  if (!activity.title || activity.title.trim() === '') {
    errors.push('El título es requerido');
  }
  
  // Solo requerir pdfId y userId si no es para generación de PDF
  if (!isForPdf) {
    if (!activity.pdfId) {
      errors.push('El ID del PDF es requerido');
    }
    
    if (!activity.userId) {
      errors.push('El ID del usuario es requerido');
    }
  }
  
  return errors;
};

export const saveActivity = async (activity: Omit<ActivityTypeActivity, 'id'>): Promise<string> => {
  try {
    const validationErrors = validateActivity(activity);
    if (validationErrors.length > 0) {
      throw new ActivityError('Datos de actividad no válidos', 'INVALID_ACTIVITY_DATA', { validationErrors });
    }
    
    const activityId = await createFirestoreActivity(activity);
    return activityId;
  } catch (error) {
    console.error('Error saving activity:', error);
    throw error instanceof ActivityError 
      ? error 
      : new ActivityError('Error al guardar la actividad', 'ACTIVITY_SAVE_ERROR', { cause: error });
  }
};

export const generatePrintableActivity = async (activity: ActivityTypeActivity): Promise<Blob> => {
  try {
    // Validate activity data with isForPdf=true to skip some validations
    const validationErrors = validateActivity(activity, true);
    if (validationErrors.length > 0) {
      console.warn('Validation warnings for PDF generation:', validationErrors);
      // No lanzamos error por validaciones durante la generación de PDF
    }
    
    // Generate PDF using the utility function
    return await generateActivityPdf(activity);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error instanceof ActivityError 
      ? error 
      : new ActivityError('Error al generar el PDF', 'PDF_GENERATION_ERROR', { cause: error });
  }
};



// Re-export functions from aiService
export { generateWordSearch, generateCrossword, generateWordConnection };