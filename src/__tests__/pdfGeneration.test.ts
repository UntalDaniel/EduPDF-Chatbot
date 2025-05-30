// @ts-nocheck
import React from 'react';
import { generateActivityPdf } from '../utils/pdfGenerator';
import { ActivityType } from '../types/activityTypes';

// Mock de la función pdf de @react-pdf/renderer
jest.mock('@react-pdf/renderer', () => ({
  pdf: jest.fn().mockReturnValue({
    toBlob: jest.fn().mockResolvedValue(new Blob())
  }),
  Document: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  Page: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  Text: ({ children }: { children: React.ReactNode }) => React.createElement('span', {}, children),
  View: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  StyleSheet: {
    create: jest.fn().mockImplementation(() => ({
      page: {},
      title: {},
      content: {}
    }))
  }
}));

describe('PDF Generation', () => {
  it('should generate a PDF blob for an activity', async () => {
    const testActivity = {
      id: '1',
      title: 'Test Activity',
      description: 'This is a test activity',
      type: ActivityType.WORD_CONNECTION,
      data: {
        words: ['word1', 'word2'],
        grid: [['w', 'o', 'r', 'd', '1'], ['w', 'o', 'r', 'd', '2']],
        solution: { test: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] }
      },
      pdfId: 'pdf1',
      userId: 'user1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await generateActivityPdf(testActivity);
    expect(result).toBeInstanceOf(Blob);
  });
});
