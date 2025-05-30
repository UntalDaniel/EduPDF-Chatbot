declare module '@react-pdf/renderer' {
  import * as React from 'react';

  export interface Style {
    [key: string]: any;
  }

  export interface Styles {
    [key: string]: Style;
  }

  export interface TextProps {
    style?: Style | Style[];
    children?: React.ReactNode;
  }

  export interface ViewProps {
    style?: Style | Style[];
    children?: React.ReactNode;
  }

  export interface PageProps {
    size?: string | number[];
    style?: Style | Style[];
    children?: React.ReactNode;
  }

  export interface DocumentProps {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    keywords?: string;
    producer?: string;
    children?: React.ReactNode;
  }

  export const StyleSheet: {
    create: <T extends Styles>(styles: T) => T;
  };

  export const Text: React.FC<TextProps>;
  export const View: React.FC<ViewProps>;
  export const Page: React.FC<PageProps>;
  export const Document: React.FC<DocumentProps>;
  
  export const pdf: (element: React.ReactElement) => {
    toBlob: () => Promise<Blob>;
    toBuffer: () => Promise<Buffer>;
    toString: () => string;
  };
}
