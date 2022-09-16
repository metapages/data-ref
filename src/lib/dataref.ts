// helpers to upload large input blobs to the cloud, when required
import objectHash from "object-hash";
import { Unibabel } from "unibabel";
import {
  DataRef,
  DataRefType,
  DataRefTypeDefault,
  InputsRefs,
  UploadFunc,
} from "./dataref-types";

const ENV_VAR_DATA_ITEM_LENGTH_MAX = 200;

export enum DataMode {
  dataref = "dataref",
  base64 = "base64",
  utf8 = "utf8",
  json = "json",
}

export const DataModeDefault = DataMode.base64;

// Takes map of DataRefs and checks if any are too big, if so
// uploads the data to the cloud, and replaces the data ref
// with a DataRef pointing to the cloud blob
export const copyLargeBlobsToRemote = async (
  inputs: InputsRefs | undefined,
  upload: UploadFunc
): Promise<InputsRefs | undefined> => {
  if (!inputs) {
    return;
  }
  const result: InputsRefs = {};

  await Promise.all(
    Object.keys(inputs).map(async (name) => {
      const type: DataRefType = inputs[name].type || DataRefTypeDefault;
      let uint8ArrayIfBig: Uint8Array | undefined;
      switch (type) {
        case DataRefType.hash:
          // this is already cloud storage. weird. or really advanced? who knows, but trust it anyway,
          break;
        case DataRefType.json:
          if (inputs[name] && inputs[name].value) {
            const jsonString = JSON.stringify(inputs[name].value);
            if (jsonString.length > ENV_VAR_DATA_ITEM_LENGTH_MAX) {
              uint8ArrayIfBig = Unibabel.utf8ToBuffer(jsonString);
            }
          }
          break;
        case DataRefType.utf8:
          if (
            inputs[name] &&
            inputs[name]?.value.length > ENV_VAR_DATA_ITEM_LENGTH_MAX
          ) {
            uint8ArrayIfBig = Unibabel.utf8ToBuffer(inputs[name].value);
          }
          break;
        // base64 is the default if unrecognized
        case DataRefType.base64:
        default:
          if (
            inputs[name] &&
            inputs[name]?.value.length > ENV_VAR_DATA_ITEM_LENGTH_MAX
          ) {
            uint8ArrayIfBig = Unibabel.base64ToBuffer(inputs[name].value);
          }
          break;
      }

      if (uint8ArrayIfBig) {
        // upload and replace the dataref
        const hash = objectHash.sha1(uint8ArrayIfBig);
        const remoteRef = await upload({ value: uint8ArrayIfBig });
        remoteRef.hash = hash;
        result[name] = remoteRef; // the server gave us this ref to use
      } else {
        // keep the dataref as is
        result[name] = inputs[name];
      }
    })
  );
  return result;
};

// const fetchBlobFromUrl = async (url: string): Promise<ArrayBuffer> => {
//   const response = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'Content-Type': "application/octet-stream" } });
//   const arrayBuffer = await response.arrayBuffer();
//   return arrayBuffer;
// }

// convert a lump of binary encoded as a base64 string into a DataRef
export const base64ToDataRef = async (
  value: string,
  options: {
    upload: (value: string) => Promise<DataRef<string>>;
    ignoreHash?: boolean;
    maxLengthUnmodified: number;
  }
): Promise<DataRef> => {
  const { upload, ignoreHash, maxLengthUnmodified = 200 } = options;
  // AWS S3 pre-signed URLs are about 500 chars
  // If the size of the value is too high then upload it to S3
  // and just store the hash value since we refer to it with that
  // but we don't store AWS S3 pre-signed URLs we give them to you when
  // you ask but we just store the hash so this value is pretty arbitray
  // but we want the size of inputs to be small since any increase gunks
  // up the state passed around (carries entire job history)
  if (value.length < maxLengthUnmodified) {
    return {
      value,
      type: DataRefType.base64,
      hash: ignoreHash ? undefined : objectHash.sha1(value),
    };
  }

  const remoteRef = await upload(value);
  if (!ignoreHash) {
    remoteRef.hash = objectHash.sha1(value);
  }

  return remoteRef;
};

export const fetchBlobFromUrl = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "Content-Type": "application/octet-stream" },
  });
  const arrayBuffer = await response.arrayBuffer();
  return arrayBuffer;
};

export const dataRefToBlob = async (dataRef: DataRef): Promise<Blob> => {
  const type: DataRefType = dataRef.type || DataRefTypeDefault;
  let buffer: ArrayBuffer | undefined;
  switch (type) {
    case DataRefType.hash:
      // this is already cloud storage. weird. or really advanced? who knows, but trust it anyway,
      throw "Cannot crate blob from type=hash";
    case DataRefType.json:
      buffer = Unibabel.utf8ToBuffer(JSON.stringify(dataRef.value));
      return new Blob([buffer!]);
    case DataRefType.utf8:
      buffer = Unibabel.utf8ToBuffer(dataRef.value);
      return new Blob([buffer!]);
    case DataRefType.url:
      buffer = await fetchBlobFromUrl(dataRef.value);
      return new Blob([buffer]);
    // base64 is the default if unrecognized
    case DataRefType.base64:
    default:
      buffer = Unibabel.base64ToBuffer(dataRef.value);
      return new Blob([buffer!]);
  }
};
