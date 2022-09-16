/**
 * The core object of this library. A DataRef is a reference to a piece of data.
 */
export type DataRef<T = string> = {
  value: T;
  hash?: string;
  type?: DataRefType;
};

// represents a way of getting a blob of data (inputs/outputs)
export enum DataRefType {
  base64 = "base64", //default, value is a base64 encoded bytes, UNLESS value is an object then it is JSON
  url = "url", // request the data at this URL
  utf8 = "utf8",
  // If DataRef.value is an object, then it is assumed to be type json
  json = "json",
  // Inline = "inline", // string or JSON as the actual final input/output data. binary is hard here, so use others when needed
  hash = "hash", // the internal system can get this data blob given the hash address (stored in the value)
}

/**
 * The default DataRefType if none is specified
 * UNLESS the value is an object, then it is assumed to be DataRefType.json
 */
export const DataRefTypeDefault = DataRefType.base64;

/**
 * Name to DataRef map
 */
export type InputsRefs = { [name in string]: DataRef };

/**
 * Name to base64 encoded buffers
 */
export type InputsBase64String = { [name in string]: string };

/**
 * Uploads or sends a blob of data to the server and returns a DataRef
 */
export type UploadFunc = (args:{value:Uint8Array, name?:string}) => Promise<DataRef>;
export type DownloadFunc = (ref:DataRef) => Promise<DataRef>;
