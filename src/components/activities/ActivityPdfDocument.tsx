import React from 'react';
import { Document, Page } from '@react-pdf/renderer';
import { ActivityTypeActivity } from '../../types/activityTypes';
import { ActivityPDF } from './PrintableView';

interface ActivityPdfDocumentProps {
  activity: ActivityTypeActivity;
}

export const ActivityPdfDocument: React.FC<ActivityPdfDocumentProps> = ({ activity }) => (
  <Document>
    <Page>
      <ActivityPDF activity={activity} />
    </Page>
  </Document>
);
