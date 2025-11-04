/**
 * Global type declarations for non-TypeScript imports
 */

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Allow side-effect CSS imports from node_modules
declare module 'driver.js/dist/driver.css' {
  const content: void;
  export default content;
}

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.sass' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.less' {
  const content: { [className: string]: string };
  export default content;
}

/**
 * Google Analytics gtag function
 */
declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
  }
}

export { };

