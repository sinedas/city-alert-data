import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.join(__dirname, '../..');
export const TASKS_DIR = path.join(ROOT, 'v1/tasks');
export const MISSIONS_JSON = path.join(ROOT, 'v1/missions.json');
export const URL_JSON = path.join(ROOT, 'url.json');
export const IMG_DIR = path.join(ROOT, 'v1/img');
/** Collections live in city-alert, not this repo. */
export const PACKAGES_DIR: string | null = null;
