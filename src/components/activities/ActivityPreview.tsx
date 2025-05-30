import React from 'react';

interface ActivityPreviewProps {
  title: string;
  children: React.ReactNode;
}

const ActivityPreview: React.FC<ActivityPreviewProps> = ({ title, children }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
};

export default ActivityPreview;