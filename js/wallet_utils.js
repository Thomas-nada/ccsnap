/*
  wallet_utils.js
  ---------------
  Shared cryptographic and address formatting utilities.
  Used by both ADA and DRep voting modules.
  FIXED: Respects network prefixes (e0 = stake_test, e1 = stake).
*/

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values) {
    const GENERATORS = [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
    let chk = 1;
    for (let v of values) {
        const top = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        for (let i = 0; i < 5; i++) {
            if ((top >> i) & 1) chk ^= GENERATORS[i];
        }
    }
    return chk;
}

function hrpExpand(hrp) {
    return [...hrp].map(c => c.charCodeAt(0) >> 5)
            .concat(0, [...hrp].map(c => c.charCodeAt(0) & 31));
}

function createChecksum(hrp, data) {
    const values = hrpExpand(hrp).concat(data, [0,0,0,0,0,0]);
    const mod = polymod(values) ^ 1;
    return Array.from({length: 6}, (_, i) => (mod >> 5 * (5 - i)) & 31);
}

function bech32Encode(hrp, data) {
    return hrp + "1" + data.concat(createChecksum(hrp, data)).map(v => CHARSET[v]).join('');
}

function convertBits(data, fromBits, toBits) {
    let acc = 0, bits = 0;
    const ret = [];
    const maxv = (1 << toBits) - 1;

    for (let value of data) {
        acc = (acc << fromBits) | value;
        bits += fromBits;
        while (bits >= toBits) {
            bits -= toBits;
            ret.push((acc >> bits) & maxv);
        }
    }

    if (bits > 0) {
        ret.push((acc << (toBits - bits)) & maxv);
    }

    return ret;
}

/**
 * Converts a Hex string (raw or prefixed) to a Bech32 Stake Address.
 * Intelligently detects network based on first byte.
 */
export function getBech32StakeAddressFromHex(hex) {
    try {
        if (!hex || typeof hex !== 'string') return null;
        hex = hex.trim().toLowerCase();

        // If it's already bech32, return as is
        if (hex.startsWith('stake')) return hex;

        let prefix = "stake"; // Default Mainnet

        // Handle 56 char raw hash (Ambiguous, assume Mainnet 'e1')
        if (hex.length === 56) {
            hex = "e1" + hex;  
        } 
        // Handle 58 char full reward address
        else if (hex.length === 58) {
            if (hex.startsWith("e0")) {
                prefix = "stake_test"; // Testnet
            } else if (!hex.startsWith("e1")) {
                // Unsupported prefix (e.g. script address)
                return null;
            }
        } else {
            return null;
        }

        const bytes = new Uint8Array(hex.match(/../g).map(x => parseInt(x, 16)));
        const words = convertBits(bytes, 8, 5);
        return bech32Encode(prefix, words);
    } catch (e) {
        console.error("Conversion error:", e);
        return null;
    }
}