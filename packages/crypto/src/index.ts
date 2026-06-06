export { generateDIDKey, publicKeyToDID, didToPublicKey } from './did.js';
export type { DIDKeyPair } from './did.js';

export { signVC, verifyVC, decodeVC } from './vc.js';
export type { VCPayload } from './vc.js';

export { createVP, verifyVP } from './vp.js';
export type { VPOptions } from './vp.js';
