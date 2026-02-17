/* eslint-disable no-useless-escape */
import JSZip from 'jszip';

import createDocumentOptionsAndMergeWithDefaults from './src/utils/options-utils';
import addFilesToContainer from './src/html-to-docx';

/// <reference types="node" />

/* -------------------------------------------------------------------------- */
/* Public types (integrated from index.d.ts)                                  */
/* -------------------------------------------------------------------------- */
export interface Margins {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  header?: number;
  footer?: number;
  gutter?: number;
}

export interface PageSize {
  width?: number;
  height?: number;
}

export interface Row {
  cantSplit?: boolean;
}

export interface Table {
  row?: Row;
  borderOptions?: {
    size?: number;
    stroke?: string;
    color?: string;
  };
  addSpacingAfter?: boolean;
}

export interface LineNumberOptions {
  start: number;
  countBy: number;
  restart: 'continuous' | 'newPage' | 'newSection';
}

export interface HeadingSpacing {
  before?: number;
  after?: number;
}

export interface HeadingStyle {
  font?: string;
  fontSize?: number;
  bold?: boolean;
  spacing?: HeadingSpacing;
  keepLines?: boolean;
  keepNext?: boolean;
  outlineLevel?: number;
}

export interface HeadingConfig {
  heading1?: HeadingStyle;
  heading2?: HeadingStyle;
  heading3?: HeadingStyle;
  heading4?: HeadingStyle;
  heading5?: HeadingStyle;
  heading6?: HeadingStyle;
}

export interface DocumentOptions {
  orientation?: 'portrait' | 'landscape';
  pageSize?: PageSize;
  margins?: Margins;
  title?: string;
  subject?: string;
  creator?: string;
  keywords?: string[];
  description?: string;
  lastModifiedBy?: string;
  revision?: number;
  createdAt?: Date;
  modifiedAt?: Date;
  headerType?: 'default' | 'first' | 'even';
  header?: boolean;
  footerType?: 'default' | 'first' | 'even';
  footer?: boolean;
  font?: string;
  fontSize?: number;
  complexScriptFontSize?: number;
  table?: Table;
  pageNumber?: boolean;
  skipFirstHeaderFooter?: boolean;
  lineNumber?: boolean;
  lineNumberOptions?: LineNumberOptions;
  numbering?: {
    defaultOrderedListStyleType?: string;
  };
  heading?: HeadingConfig;
  decodeUnicode?: boolean;
  lang?: string;
  direction?: 'ltr' | 'rtl';
  preprocessing?: {
    skipHTMLMinify?: boolean;
  };
  imageProcessing?: {
    maxRetries?: number;
    verboseLogging?: boolean;
    downloadTimeout?: number;
    maxImageSize?: number;
    retryDelayBase?: number;
    minTimeout?: number;
    maxTimeout?: number;
    minImageSize?: number;
    maxCacheSize?: number;
    maxCacheEntries?: number;
    svgHandling?: 'convert' | 'native' | 'auto';
    suppressSharpWarning?: boolean;
    svgSanitization?: boolean;
  };
}

// Minification is disabled in browser environment to avoid Node.js dependencies
const minifyHTMLString = async (htmlString: string): Promise<string> => {
  // In browser, we skip minification since html-minifier-terser depends on clean-css
  // which tries to access Node.js APIs (process, os, etc.)
  return htmlString;
};

async function generateContainer(
  htmlString: string,
  headerHTMLString?: string | null,
  documentOptions: DocumentOptions = {},
  footerHTMLString?: string | null,
): Promise<ArrayBuffer | Blob | Buffer> {
  const zip = new JSZip();

  const normalizedDocumentOptions = createDocumentOptionsAndMergeWithDefaults(documentOptions);

  let contentHTML = htmlString;
  let headerHTML = headerHTMLString;
  let footerHTML = footerHTMLString;
  if (htmlString && !normalizedDocumentOptions['preprocessing']['skipHTMLMinify']) {
    contentHTML = await minifyHTMLString(contentHTML);
  }
  if (headerHTMLString && !normalizedDocumentOptions['preprocessing']['skipHTMLMinify']) {
    headerHTML = await minifyHTMLString(headerHTMLString);
  }
  if (footerHTMLString && !normalizedDocumentOptions['preprocessing']['skipHTMLMinify']) {
    footerHTML = await minifyHTMLString(footerHTMLString);
  }

  await addFilesToContainer(zip, contentHTML, normalizedDocumentOptions, headerHTML, footerHTML);

  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  if (Object.prototype.hasOwnProperty.call(global, 'Buffer')) {
    return Buffer.from(new Uint8Array(buffer));
  }
  if (Object.prototype.hasOwnProperty.call(global, 'Blob')) {
    // eslint-disable-next-line no-undef
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
  throw new Error(
    'Add blob support using a polyfill eg https://github.com/bjornstar/blob-polyfill'
  );
}

export default generateContainer;
