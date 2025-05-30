import React from 'react';
import { Document, Page } from '@react-pdf/renderer';
import { ActivityTypeActivity } from '../types/activityTypes';
import { ActivityPDF } from './activities/PrintableView';

interface PdfGeneratorProps {
  activity: ActivityTypeActivity;
}

const PdfGenerator: React.FC<PdfGeneratorProps> = ({ activity }) => (
  <Document>
    <Page>
      <ActivityPDF activity={activity} />
    </Page>
  </Document>
);

export default PdfGenerator;
