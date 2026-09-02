/**
 * Application constants and configuration values.
 *
 * NOTE: This file is automatically updated by the init script.
 * Manual changes may be overwritten during project initialization.
 */

// --- App Configuration ---
/**
 * The base URL of the application.
 * Used for generating absolute URLs for assets and API endpoints.
 */
export const APP_URL: string = 'https://pnyx.despell.io';

/**
 * The name of the app as displayed to users.
 */
export const APP_NAME: string = 'PNYX';

/**
 * A brief description of the app. Used in metadata.
 */
export const APP_DESCRIPTION: string = 'A Farcaster mini app';

// --- Asset URLs ---
/**
 * URL for the app's icon image.
 */
export const APP_ICON_URL: string = `${APP_URL}/icon.png`;

// --- Integration Configuration ---
/**
 * Flag to enable/disable wallet functionality.
 */
export const USE_WALLET: boolean = true;

/**
 * Flag to enable/disable analytics tracking.
 */
export const ANALYTICS_ENABLED: boolean = true;

/**
 * Required chains (CAIP-2). Empty = render regardless of chain support.
 */
export const APP_REQUIRED_CHAINS: string[] = [];

/**
 * Return URL for the mini app back button. Undefined = none.
 */
export const RETURN_URL: string | undefined = undefined;

// PLEASE DO NOT UPDATE THIS
export const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: 'Farcaster SignedKeyRequestValidator',
  version: '1',
  chainId: 10,
  verifyingContract:
    '0x00000000fc700472606ed4fa22623acf62c60553' as `0x${string}`,
};

// PLEASE DO NOT UPDATE THIS
export const SIGNED_KEY_REQUEST_TYPE = [
  { name: 'requestFid', type: 'uint256' },
  { name: 'key', type: 'bytes' },
  { name: 'deadline', type: 'uint256' },
];
