/**
 * Utility functions for handling image URLs, including data URLs
 */

/**
 * Checks if a string is a data URL
 */
export const isDataURL = (str: string | null | undefined): boolean => {
  if (!str) return false;
  return str.startsWith('data:image/');
};

/**
 * Converts a data URL to a blob URL for better performance
 * Note: Remember to revoke the blob URL when done to prevent memory leaks
 */
export const dataURLToBlobURL = (dataURL: string): Promise<string> => {
  if (!isDataURL(dataURL)) {
    return Promise.resolve(dataURL); // Return as-is if not a data URL
  }

  try {
    // Convert data URL to blob
    const response = fetch(dataURL);
    return response.then(res => res.blob())
      .then(blob => URL.createObjectURL(blob))
      .catch(() => dataURL); // Fallback to data URL if conversion fails
  } catch (error) {
    console.error('Error converting data URL to blob URL:', error);
    return Promise.resolve(dataURL); // Fallback to data URL
  }
};

/**
 * Gets a safe image URL that can be used in img src or CSS background-image
 * Data URLs work fine in browsers, but this ensures proper handling and validation
 */
export const getImageUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  
  // Data URLs work directly in img src and CSS background-image
  // Validate the format to ensure it's properly formatted
  if (isDataURL(url)) {
    // Validate data URL format - check for common image MIME types
    const dataUrlPattern = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|bmp|ico);base64,/i;
    if (dataUrlPattern.test(url)) {
      return url; // Valid data URL, use as-is
    }
    // If it's a data URL but doesn't match the pattern, check if it starts with data:image/
    if (url.startsWith('data:image/')) {
      // It's a data URL, even if the MIME type isn't in our list, try to use it
      return url;
    }
    // Malformed data URL
    console.warn('Malformed data URL detected');
    return url; // Still try to use it, browser might handle it
  }
  
  // Regular URL (http, https, file, etc.)
  return url;
};

/**
 * Creates a memoized blob URL from a data URL
 * Use this when you need to convert data URLs to blob URLs for performance
 * Remember to call revokeImageUrl when the component unmounts
 */
export const createImageBlobUrl = (dataURL: string | null | undefined): string | null => {
  if (!dataURL || !isDataURL(dataURL)) {
    return dataURL || null;
  }

  try {
    // Convert base64 to blob
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([ab], { type: mimeString });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error creating blob URL from data URL:', error);
    return dataURL; // Fallback to data URL
  }
};

/**
 * Revokes a blob URL to free memory
 */
export const revokeImageUrl = (url: string | null | undefined): void => {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error revoking blob URL:', error);
    }
  }
};

