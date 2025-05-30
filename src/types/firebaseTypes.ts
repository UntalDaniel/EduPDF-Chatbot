import { User } from 'firebase/auth';

export type FirebaseUserType = User;

export interface FirebaseErrorType {
    code: string;
    message: string;
} 