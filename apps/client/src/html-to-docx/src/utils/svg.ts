import { buildImage } from './image';
import { sanitizeSVGVNode, validateSVGString } from './svg-sanitizer';

/* -------------------------------------------------------------------------- */
/* Local Type Definitions (inferred)                                          */
/* -------------------------------------------------------------------------- */
type AttrMap = Record<string, unknown>;

interface SVGVNode {
  tagName?: string;
  properties?: {
    attributes?: AttrMap;
    style?: Record<string, unknown>;
    [key: string]: any;
  };
  children?: Array<string | SVGVNode | { text?: string }>;
  text?: string;
  [k: string]: any;
}


/**
 * Serializes a VNode to an SVG XML string
 * @param {Object} vNode - The VNode representing an SVG element
 * @param {boolean} isRoot - Whether this is the root SVG element
 * @returns {string} The serialized SVG XML string
 */
const serializeVNodeToSVG = (vNode: SVGVNode | null | undefined, isRoot = false): string => {
  if (!vNode || !vNode.tagName) {
    return '';
  }

  const { properties, children = [] } = vNode as SVGVNode;
  const tagName: string = (vNode as SVGVNode).tagName as string;
  const attributes: AttrMap = (properties && properties.attributes) || {};
  const style: Record<string, unknown> = (properties && properties.style) || {};

  // Build opening tag with attributes
  let svg = `<${tagName}`;

  // For root SVG element, always ensure xmlns namespace is present
  if (isRoot && tagName === 'svg' && !attributes.xmlns) {
    svg += ' xmlns="http://www.w3.org/2000/svg"';
  }

  // Add regular attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (value) {
      // Escape quotes and special XML characters in attribute values
      const escapedValue = String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      svg += ` ${key}="${escapedValue}"`;
    }
  });

  // Add style attribute if present
  if (Object.keys(style).length > 0) {
    const styleString = Object.entries(style)
      .map(([key, value]) => `${key}:${value}`)
      .join(';');
    svg += ` style="${styleString}"`;
  }

  // Handle self-closing tags or tags with children
  if (children.length === 0) {
    // Some SVG elements should not be self-closing (like <g></g>, <title></title>)
    const nonSelfClosingTags = ['g', 'title', 'desc', 'defs', 'text'];
    if (nonSelfClosingTags.includes(tagName)) {
      svg += `></${tagName}>`;
    } else {
      svg += ' />';
    }
  } else {
    svg += '>';

    // Serialize children
    children.forEach((child) => {
      if (typeof child === 'string') {
        // Text content - escape special XML characters
        const escapedText = child
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        svg += escapedText;
      } else if ((child as any).text) {
        // VText node - escape special XML characters
        const escapedText = String((child as any).text)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        svg += escapedText;
      } else if ((child as any).tagName) {
        // Recursive VNode (not root)
        svg += serializeVNodeToSVG(child as SVGVNode, false);
      }
    });

    svg += `</${tagName}>`;
  }

  return svg;
};

/**
 * Processes an inline SVG element by converting it to a data URI and handling it like an image
 * @param {Object} docxDocumentInstance - The document instance
 * @param {Object} vNode - The VNode representing the SVG element
 * @param {number|null} maximumWidth - Maximum width for the image
 * @param {Object} options - Processing options
 * @param {boolean} options.svgSanitization - Enable/disable SVG sanitization (default: true)
 * @param {boolean} options.verboseLogging - Enable detailed logging
 * @returns {Promise<Object|null>} XML fragment or null
 */
// eslint-disable-next-line import/prefer-default-export
export const buildSVGElement = async (
  docxDocumentInstance: any,
  vNode: SVGVNode,
  maximumWidth: number | null = null,
  options: { svgSanitization?: boolean; verboseLogging?: boolean; [k: string]: any } = {}
): Promise<any | null> => {
  try {
    // Get sanitization settings from options or document instance
    // Resolve svgSanitization flag with explicit undefined checks so `false` is respected
    let svgSanitization = true;
    let svgSanitizationSource = 'default';
    if (options && Object.prototype.hasOwnProperty.call(options, 'svgSanitization')) {
      svgSanitization = Boolean(options.svgSanitization);
      svgSanitizationSource = 'options';
    } else if (
      docxDocumentInstance &&
      docxDocumentInstance.imageProcessing &&
      Object.prototype.hasOwnProperty.call(docxDocumentInstance.imageProcessing, 'svgSanitization')
    ) {
      svgSanitization = Boolean(docxDocumentInstance.imageProcessing.svgSanitization);
      svgSanitizationSource = 'docxDocumentInstance.imageProcessing';
    }

    const verboseLogging: boolean =
      typeof options.verboseLogging !== 'undefined'
        ? Boolean(options.verboseLogging)
        : !!(docxDocumentInstance && docxDocumentInstance.imageProcessing && docxDocumentInstance.imageProcessing.verboseLogging);

    if (verboseLogging) {
      // eslint-disable-next-line no-console
      console.log(`[SVG] svgSanitization resolved to ${svgSanitization} (source=${svgSanitizationSource})`);
    }

    // Sanitize (or skip sanitization) using the resolved svgSanitization flag
    const sanitizedVNode: SVGVNode | null = sanitizeSVGVNode(vNode as any, { verboseLogging, enabled: svgSanitization });

    if (!sanitizedVNode) {
      if (svgSanitization) {
        // eslint-disable-next-line no-console
        console.error('[ERROR] buildSVGElement: SVG element was blocked by sanitizer');
      }
      return null;
    }

    if (svgSanitization && verboseLogging) {
      // eslint-disable-next-line no-console
      console.log('[SVG] Sanitization completed successfully');
    }

    if (!svgSanitization && verboseLogging) {
      // eslint-disable-next-line no-console
      console.warn('[SVG] WARNING: SVG sanitization is disabled - only use with trusted content!');
    }

    // Serialize the SVG VNode to an SVG string (isRoot=true for proper namespace handling)
    const svgString: string = serializeVNodeToSVG(sanitizedVNode, true);

    if (typeof svgString !== 'string' || svgString.trim().length === 0) {
      // eslint-disable-next-line no-console
      console.error('[ERROR] buildSVGElement: Failed to serialize SVG element');
      return null;
    }

    // Validate the serialized SVG string for any remaining dangerous content
    if (svgSanitization) {
      const validation = validateSVGString(svgString);
      if (!validation.valid && verboseLogging) {
        // eslint-disable-next-line no-console
        console.warn('[SVG] Validation warnings:', validation.warnings);
      }
    }

    // Log the serialized SVG for debugging (if verbose logging is enabled)
    if (verboseLogging) {
      // eslint-disable-next-line no-console
      console.log(
        `[DEBUG] Serialized SVG (${svgString.length} chars): ${svgString.substring(0, 200)}...`
      );
    }

    // Convert SVG string to base64 data URI
    const base64SVG = Buffer.from(svgString, 'utf-8').toString('base64');
    const dataUri = `data:image/svg+xml;base64,${base64SVG}`;

    // Extract dimensions from SVG attributes
    // Width and height might be numbers, strings with units, or missing
    let width: number | undefined;
    let height: number | undefined;

    if (vNode.properties?.attributes?.width) {
      const widthStr = String(vNode.properties.attributes.width);
      // Remove units (px, pt, etc.) and parse as number
      const parsedWidth = parseInt(widthStr.replace(/[^\d.]/g, ''), 10);
      if (!Number.isNaN(parsedWidth)) width = parsedWidth;
    }

    if (vNode.properties?.attributes?.height) {
      const heightStr = String(vNode.properties.attributes.height);
      const parsedHeight = parseInt(heightStr.replace(/[^\d.]/g, ''), 10);
      if (!Number.isNaN(parsedHeight)) height = parsedHeight;
    }

    // If dimensions are from style attribute, use those
    if (vNode.properties?.style?.width) {
      const styleWidth = parseInt(String(vNode.properties.style.width).replace(/[^\d.]/g, ''), 10);
      if (!Number.isNaN(styleWidth)) {
        width = styleWidth;
      }
    }

    if (vNode.properties?.style?.height) {
      const styleHeight = parseInt(
        String(vNode.properties.style.height).replace(/[^\d.]/g, ''),
        10
      );
      if (!Number.isNaN(styleHeight)) {
        height = styleHeight;
      }
    }

    // If width/height are still missing, try to extract from viewBox
    if ((!width || !height) && vNode.properties?.attributes?.viewBox) {
      const viewBox = String(vNode.properties.attributes.viewBox).trim();
      // viewBox format: "minX minY width height"
      const viewBoxParts = viewBox.split(/\s+/);
      if (viewBoxParts.length === 4) {
        const vbWidth = parseFloat(viewBoxParts[2]);
        const vbHeight = parseFloat(viewBoxParts[3]);
        if (!width && !Number.isNaN(vbWidth) && vbWidth > 0) {
          width = Math.round(vbWidth);
        }
        if (!height && !Number.isNaN(vbHeight) && vbHeight > 0) {
          height = Math.round(vbHeight);
        }
      }
    }

    // Create a temporary vNode that looks like an img element with the SVG data URI
    const imgVNode: any = {
      tagName: 'img',
      properties: {
        src: dataUri,
        alt: vNode.properties?.attributes?.title || 'SVG image',
        ...(width && { width }),
        ...(height && { height }),
      },
    };

    // Use the existing buildImage function to process the SVG as an image
    // eslint-disable-next-line no-use-before-define
    // Use `any` cast for maximumWidth here to match legacy untyped `buildImage` signature
    return await buildImage(docxDocumentInstance, imgVNode, maximumWidth as any, options);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[ERROR] buildSVGElement: Error processing inline SVG:', error);
    return null;
  }
};
