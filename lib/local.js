import { readFile } from 'fs/promises';
import { extname, join, relative } from 'path';

/**
 * Default URL mapping function.
 * Strips the target base URL prefix and joins the remainder onto the local
 * directory, tolerating a trailing slash on either side.
 */
function defaultMapping(url, { targetBaseUrl, localDir } = {}) {
  const base = stripTrailingSlash(targetBaseUrl);
  const rest = url.startsWith(base) ? url.slice(base.length) : url;
  return join(localDir, rest);
}

/**
 * Default URL mapping function for Miso.
 */
export function defaultMisoUrlMapping(url, options = {}) {
  let path = defaultMapping(url, options);
  path = stripVersionFromPath(path);
  path = stripDotMinFromPath(path);
  return path;
}

/**
 * Default URL filtering function.
 */
function defaultFilter(url, { targetBaseUrl } = {}) {
  return url.startsWith(targetBaseUrl);
}

const VERSION_REGEX = /\/(latest|beta|\d+\.\d+(?:\.\d+(?:-[^\/]+)?)?)\//;

/**
 * Strip version from path. 
 * Version pattern = /latest/, /beta/, or semantic version /2.3.4/, /2.3.5-beta.1/
 * 
 * @param {string} path e.g. "/miso-***-script/2.3.4/rest/miso-***-script.js"
 * @returns {string} e.g. "/miso-***-script/rest/miso-***-script.js"
 */
function stripVersionFromPath(path) {
  return path.replace(VERSION_REGEX, '/');
}

/**
 * Strip .min.js from path.
 * e.g. "/miso-***-script/rest/miso-***-script.min.js" -> "/miso-***-script/rest/miso-***-script.js"
 */
function stripDotMinFromPath(path) {
  return path.replace(/\.min\.js$/, '.js');
}

const HELPERS = {
  defaultFilter,
  defaultMapping,
  stripVersionFromPath,
  stripDotMinFromPath,
};

/**
 * Intercept some resource requests and replace them with local files.
 *
 * Maps CDN paths like:
 *   /miso-***-script/{version}/miso-{site}.min.js -> dist/miso-{site}.js
 */
export async function useLocalBuild(page, {
  filter = defaultFilter,
  mapping = defaultMapping,
  ...options
} = {}) {
  const context = { ...HELPERS, ...options };
  await page.route(
    url => filter(url, context),
    async (route) => {
      const url = route.request().url();
      const localFile = mapping(url, context);
      let body;
      try {
        body = await readFile(localFile, isText(localFile) ? 'utf-8' : undefined);
      } catch {
        console.warn(`[injection] Local file not found: ${relative(process.cwd(), localFile)} — falling through to CDN`);
        await route.continue();
        return;
      }
      console.log(`[injection] ${removeQueryString(url)} -> ${relative(process.cwd(), localFile)}`);
      await route.fulfill({
        status: 200,
        contentType: contentType(localFile),
        body,
      });
    }
  );
}

// helpers //
const CONTENT_TYPES = {
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};
const TEXT_EXTENSIONS = new Set(['.js', '.css', '.svg']);

function contentType(filename) {
  return CONTENT_TYPES[extname(filename)] ?? 'application/octet-stream';
}

function isText(filename) {
  return TEXT_EXTENSIONS.has(extname(filename));
}

function removeQueryString(url) {
  return url.split('?')[0];
}

function stripTrailingSlash(s) {
  return s.replace(/\/+$/, '');
}
