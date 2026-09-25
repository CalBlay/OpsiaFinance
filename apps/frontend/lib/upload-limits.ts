/** Per sota del límit de 4,5 MB del cos de les funcions a Vercel (amb el multipart). */
export const UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024;

/** Mateix sostre que `serverActions.bodySizeLimit`. */
export const UPLOAD_FILE_MAX_BYTES = 50 * 1024 * 1024;
