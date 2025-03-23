// @ts-check

const CUSTOM_ACTION_APPCACHE_REMOVE = "appcache-remove";

/**
 * @typedef {Object} PayloadInfo
 * @property {string} displayTitle
 * @property {string} description
 * @property {string} fileName - path relative to the payloads folder
 * @property {string} author
 * @property {string} projectSource
 * @property {string} binarySource - should be direct download link to the included version, so that you can verify the hashes
 * @property {string} version
 * @property {string[]?} [supportedFirmwares] - optional, these are interpreted as prefixes, so "" would match all, and "4." would match 4.xx, if not set, the payload is assumed to be compatible with all firmwares
 * @property {number?} [toPort] - optional, if the payload should be sent to "127.0.0.1:<port>" instead of loading directly, if specified it'll show up in webkit-only mode too
 * @property {string?} [customAction]
 */

/**
 * @type {PayloadInfo[]}
*/
const payload_map = [
     {   auto-loaded
         displayTitle: "etaHEN",
         description: "UetaHEN",
         fileName: "etaHEN.bin",
         author: "_",
         projectSource: "_",
         binarySource: "_",
         version: "0.18.1",
         supportedFirmwares: ["1.", "2.", "3.", "4.", "5."]
    },
,
    {
        displayTitle: 'elfldr',
        description: 'elfldr',
        fileName: 'elfldr.bin',
        author: '-',
        source: '-', 
        version: '-' 
    }
];

