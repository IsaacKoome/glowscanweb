// lib/chat.ts
import { firestore } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const createConversation = async (userId: string) => {
  const conversationRef = await addDoc(collection(firestore, 'users', userId, 'conversations'), {
    createdAt: serverTimestamp(),
    // You might want to add a default name for the conversation here
    name: `Analysis - ${new Date().toLocaleString()}`
  });
  return conversationRef.id;
};

export const addMessage = async (conversationId: string, userId:string, text: string, sender: 'user' | 'ai', analysisData: object | null = null) => {
  const messageData: {
    userId: string;
    text: string;
    sender: 'user' | 'ai';
    createdAt: object;
    analysisData?: object;
    type: 'text' | 'analysis_result';
  } = {
    userId,
    text,
    sender,
    createdAt: serverTimestamp(),
    type: analysisData ? 'analysis_result' : 'text',
  };

  if (analysisData) {
    messageData.analysisData = analysisData;
  }

  await addDoc(collection(firestore, 'users', userId, 'conversations', conversationId, 'messages'), messageData);
};

