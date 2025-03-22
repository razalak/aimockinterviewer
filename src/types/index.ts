import { FieldValue, Timestamp } from "firebase/firestore";

export interface User {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  createdAt: Timestamp | FieldValue;
  updateAt: Timestamp | FieldValue;
}

export interface Interview {
  id: string;
  userId: string;
  position: string;
  description: string;
  experience: number;
  techStack: string;
  questions: any[];
  createdAt: any;
  updatedAt: any;
  candidateProfile: {
    position: string;
    experience: number;
    techStack: string;
    description: string;
    education: string;
    latestCompany: string;
    projects: string;
  };
}

export interface UserAnswer {
  id: string;
  mockIdRef: string;
  question: string;
  correct_ans: string;
  user_ans: string;
  feedback: string;
  rating: number;
  userId: string;
  createdAt: Timestamp;
  updateAt: Timestamp;
}
