/* tslint:disable */
/* eslint-disable */

export function Pdf_BytesToDocument(input: string): Promise<string>;

/**
 * Parses the input PDF file (as a base64 encoded string), outputs the parsed
 * PDF (and any warnings) as a JSON object
 *
 * ```js,no_run,ignore
 * let input = JSON.encode({ pdf_base64: atob(my_pdf) });
 * let doc = JSON.parse(Pdf_BytesToPdfDocument(input));
 * console.log(doc.pdf);
 * console.log(doc.warnings);
 * // {
 * //   status: 0,
 * //   data: {
 * //     metadata: ...,
 * //     resources: ...,
 * //     bookmarks: ...,
 * //     pages: [{ media_box, trim_box, crop_box, ops }]
 * //    }
 * // }
 * ```
 */
export function Pdf_BytesToDocumentSync(input: string): string;

export function Pdf_DocumentToBytes(input: string): Promise<string>;

/**
 * Takes a `PdfDocument` JS object and returns the base64 PDF bytes
 */
export function Pdf_DocumentToBytesSync(input: string): string;

export function Pdf_HtmlToDocument(input: string): Promise<string>;

/**
 * Parses the input HTML, converts it to PDF pages and outputs the generated
 * PDF as a JSON object
 *
 * ```js,no_run,ignore
 * let html = "<!doctype html><html><body><h1>Hello!</h1></body></html>";
 * let input = JSON.encode({ html: html, title "My PDF!" });
 * let document = JSON.parse(Pdf_HtmlToPdfDocument(input));
 * console.log(document);
 * // {
 * //   status: 0,
 * //   data: {
 * //     metadata: ...,
 * //     resources: ...,
 * //     bookmarks: ...,
 * //     pages: [{ media_box, trim_box, crop_box, ops }]
 * //    }
 * // }
 * ```
 */
export function Pdf_HtmlToDocumentSync(input: string): string;

export function Pdf_PageToSvg(input: string): Promise<string>;

/**
 * Takes a `PdfPage` JS object and outputs the SVG string for that page
 */
export function Pdf_PageToSvgSync(input: string): string;

export function Pdf_ResourcesForPage(input: string): Promise<string>;

/**
 * Helper function that takes a PDF page and outputs a list of all
 * images IDs / fonts IDs that have to be gathered from the documents
 * resources in order to render this page.
 */
export function Pdf_ResourcesForPageSync(input: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly Pdf_BytesToDocument: (a: number, b: number) => any;
    readonly Pdf_BytesToDocumentSync: (a: number, b: number) => [number, number];
    readonly Pdf_DocumentToBytes: (a: number, b: number) => any;
    readonly Pdf_DocumentToBytesSync: (a: number, b: number) => [number, number];
    readonly Pdf_HtmlToDocument: (a: number, b: number) => any;
    readonly Pdf_HtmlToDocumentSync: (a: number, b: number) => [number, number];
    readonly Pdf_PageToSvg: (a: number, b: number) => any;
    readonly Pdf_PageToSvgSync: (a: number, b: number) => [number, number];
    readonly Pdf_ResourcesForPage: (a: number, b: number) => any;
    readonly Pdf_ResourcesForPageSync: (a: number, b: number) => [number, number];
    readonly wasm_bindgen__closure__destroy__h5eff59757512815b: (a: number, b: number) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h0f6501f88b219e2a: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h86981c9f4215b9b0: (a: number, b: number, c: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
