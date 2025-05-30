import * as React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ActivityTypeActivity } from '../types/activityTypes';

const styles = StyleSheet.create({
  page: {
    padding: 30,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  content: {
    fontSize: 14,
    lineHeight: 1.5,
  },
});

interface Props {
  activity: ActivityTypeActivity;
}

const PdfDocument: React.FC<Props> = ({ activity }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.title}>{activity.title}</Text>
          <Text style={styles.content}>
            {activity.description || 'No description provided.'}
          </Text>
          {/* Add more activity content here as needed */}
        </View>
      </Page>
    </Document>
  );
};

export default PdfDocument;
