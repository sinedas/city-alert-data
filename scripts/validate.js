#!/usr/bin/env node

/**
 * Mission Data Validation Script
 * Validates JSON files in city-alert-data/v1/tasks/
 * 
 * Usage: node scripts/validate.js [mission.json]
 *        node scripts/validate.js           # Validates all missions
 */

const fs = require('fs');
const path = require('path');

// ANSI Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Counters
let totalErrors = 0;
let totalWarnings = 0;

// Valid task types
const VALID_TASK_TYPES = [
  'text_answer',
  'wordle',
  'photoValidation',
  'timepointer',
  'timeline',
  'team_name',
  'roulette',
  'audio'
];

// Required fields for all tasks
const REQUIRED_FIELDS = ['id', 'name', 'lat', 'lng'];

/**
 * Log helpers
 */
function error(msg) {
  console.error(`  ${RED}✗${RESET} ${msg}`);
  totalErrors++;
}

function warning(msg) {
  console.warn(`  ${YELLOW}⚠${RESET} ${msg}`);
  totalWarnings++;
}

function success(msg) {
  console.log(`  ${GREEN}✓${RESET} ${msg}`);
}

function info(msg) {
  console.log(`${BLUE}ℹ${RESET} ${msg}`);
}

/**
 * Check if file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (e) {
    return false;
  }
}

/**
 * Load JSON file
 */
function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    error(`Failed to parse JSON: ${e.message}`);
    return null;
  }
}

/**
 * Get available collection files
 */
function getAvailableCollections() {
  const configDir = path.join(__dirname, '../../city-alert/config');
  if (!fs.existsSync(configDir)) {
    return [];
  }
  
  const files = fs.readdirSync(configDir);
  return files
    .filter(f => f.endsWith('.json') && !f.includes('_copy'))
    .map(f => f.replace('.json', ''));
}

/**
 * Validate a single mission file
 */
function validateMission(filename, challengeCode) {
  console.log(`\n${BOLD}📝 Validating ${filename}...${RESET}`);
  
  const filePath = path.join(__dirname, '../v1/tasks', filename);
  const imgDir = path.join(__dirname, '../v1/img', challengeCode);
  const audioDir = path.join(__dirname, '../v1/audio', challengeCode);
  
  // Load tasks
  const tasks = loadJSON(filePath);
  if (!tasks) {
    return;
  }
  
  if (!Array.isArray(tasks)) {
    error('JSON root must be an array');
    return;
  }
  
  const taskCount = tasks.length;
  info(`Found ${taskCount} tasks`);
  
  // Get all task IDs for reference checking
  const taskIds = new Set(tasks.map(t => t.id));
  
  // Get available collections
  const availableCollections = getAvailableCollections();
  
  // Track used and available images
  const usedImages = new Set();
  const availableImages = new Set();
  if (fs.existsSync(imgDir)) {
    fs.readdirSync(imgDir).forEach(f => {
      if (f.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
        availableImages.add(f);
      }
    });
  }
  
  // 1. Check for duplicate IDs
  const ids = tasks.map(t => t.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    error('Duplicate task IDs found');
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    duplicates.forEach(id => error(`  Duplicate ID: "${id}"`));
  } else {
    success(`All ${taskCount} task IDs are unique`);
  }
  
  // 2. Validate each task
  tasks.forEach((task, index) => {
    const taskPrefix = `Task [${index}] "${task.id || 'NO_ID'}"`;
    
    // 2a. Required fields
    REQUIRED_FIELDS.forEach(field => {
      if (task[field] === undefined || task[field] === null || task[field] === '') {
        error(`${taskPrefix}: Missing required field "${field}"`);
      }
    });
    
    // 2b. Valid task type (with default handling)
    const taskType = task.type || 'text_answer'; // Default type
    if (!VALID_TASK_TYPES.includes(taskType)) {
      error(`${taskPrefix}: Invalid type "${taskType}". Must be one of: ${VALID_TASK_TYPES.join(', ')}`);
    }
    if (!task.type) {
      // Uncomment if you want to warn about missing type:
      // warning(`${taskPrefix}: No type specified, using default "text_answer"`);
    }
    
    // 2c. Coordinate validation
    if (typeof task.lat === 'number') {
      if (task.lat < -90 || task.lat > 90) {
        error(`${taskPrefix}: Invalid latitude ${task.lat} (must be -90 to 90)`);
      }
    }
    if (typeof task.lng === 'number') {
      if (task.lng < -180 || task.lng > 180) {
        error(`${taskPrefix}: Invalid longitude ${task.lng} (must be -180 to 180)`);
      }
    }
    
    // 2d. NextTaskId reference
    if (task.nextTaskId && !taskIds.has(task.nextTaskId)) {
      error(`${taskPrefix}: nextTaskId "${task.nextTaskId}" does not exist`);
    }
    
    // 2e. Image validation
    if (task.image) {
      if (!task.image.startsWith('http')) {
        const imgPath = path.join(imgDir, task.image);
        if (!fileExists(imgPath)) {
          error(`${taskPrefix}: Image file not found: ${task.image}`);
        } else {
          usedImages.add(task.image);
        }
      }
    }
    
    // 2f. StartCarousel images
    if (task.startCarousel && task.startCarousel.images) {
      task.startCarousel.images.forEach(img => {
        if (!img.startsWith('http')) {
          const imgPath = path.join(imgDir, img);
          if (!fileExists(imgPath)) {
            error(`${taskPrefix}: Carousel image not found: ${img}`);
          } else {
            usedImages.add(img);
          }
        }
      });
    }
    
    // 2g. Reward images and transformedImage validation
    if (task.reward) {
      // Validate reward image
      if (task.reward.image) {
        const img = task.reward.image;
        if (!img.startsWith('http')) {
          const imgPath = path.join(imgDir, img);
          if (!fileExists(imgPath)) {
            error(`${taskPrefix}: Reward image not found: ${img}`);
          } else {
            usedImages.add(img);
          }
        }
      }
      
      // Validate transformedImage reference
      if (task.reward.transformedImage) {
        const refTaskId = task.reward.transformedImage;
        if (!taskIds.has(refTaskId)) {
          error(`${taskPrefix}: reward.transformedImage "${refTaskId}" references non-existent task`);
        }
      }
    }
    
    // 2h. Audio validation
    if (task.audio) {
      const audioPath = path.join(audioDir, task.audio);
      if (!fileExists(audioPath)) {
        error(`${taskPrefix}: Audio file not found: ${task.audio}`);
      }
    }
    
    // 2i. Timeline/Timepointer validation
    const actualType = task.type || 'text_answer';
    if (actualType === 'timeline' || actualType === 'timepointer') {
      if (task.random) {
        // Using collection
        if (!availableCollections.includes(task.random)) {
          error(`${taskPrefix}: Collection "${task.random}.json" not found in city-alert/config/`);
        }
      } else if (task.events) {
        // Using inline events
        if (!Array.isArray(task.events)) {
          error(`${taskPrefix}: events must be an array`);
        } else {
          // Check order sequence
          const orders = task.events.map(e => e.order).filter(o => typeof o === 'number');
          const sortedOrders = [...orders].sort((a, b) => a - b);
          
          // Check if orders are 1,2,3,4
          const expectedOrders = Array.from({ length: orders.length }, (_, i) => i + 1);
          const ordersMatch = JSON.stringify(sortedOrders) === JSON.stringify(expectedOrders);
          
          if (!ordersMatch) {
            warning(`${taskPrefix}: Event orders should be sequential 1,2,3,4... Found: ${sortedOrders.join(',')}`);
          }
          
          // Check for event images
          task.events.forEach((event, i) => {
            if (event.image && !event.image.startsWith('http')) {
              const imgPath = path.join(imgDir, event.image);
              if (!fileExists(imgPath)) {
                error(`${taskPrefix}: Event[${i}] image not found: ${event.image}`);
              } else {
                usedImages.add(event.image);
              }
            }
          });
        }
      } else {
        error(`${taskPrefix}: timeline/timepointer must have either "random" or "events" field`);
      }
    }
    
    // 2j. PhotoValidation validation
    if (actualType === 'photoValidation') {
      if (!task.photoValidation) {
        error(`${taskPrefix}: photoValidation type must have "photoValidation" config`);
      } else {
        if (!task.photoValidation.prompt) {
          error(`${taskPrefix}: photoValidation must have "prompt"`);
        }
      }
    }
    
    // 2k. Numeric constraints
    if (task.points !== undefined && task.points < 0) {
      error(`${taskPrefix}: points cannot be negative`);
    }
    if (task.attempts !== undefined && task.attempts <= 0) {
      error(`${taskPrefix}: attempts must be positive`);
    }
    if (task.time !== undefined && task.time <= 0) {
      error(`${taskPrefix}: time must be positive`);
    }
    
    // 2l. Fallback validation
    if (task.fallback) {
      if (!task.fallback.type) {
        error(`${taskPrefix}: fallback must have "type" field`);
      } else if (!VALID_TASK_TYPES.includes(task.fallback.type)) {
        error(`${taskPrefix}: fallback.type "${task.fallback.type}" is invalid`);
      }
      
      if (task.fallback.random && !availableCollections.includes(task.fallback.random)) {
        error(`${taskPrefix}: fallback collection "${task.fallback.random}.json" not found`);
      }
      
      if (task.fallback.image && !task.fallback.image.startsWith('http')) {
        const imgPath = path.join(imgDir, task.fallback.image);
        if (!fileExists(imgPath)) {
          error(`${taskPrefix}: fallback image not found: ${task.fallback.image}`);
        } else {
          usedImages.add(task.fallback.image);
        }
      }
    }
  });
  
  // 3. Check for duplicate nextTaskId (branching detection)
  const nextTaskIdMap = new Map(); // nextTaskId -> [taskIds that point to it]
  tasks.forEach(task => {
    if (task.nextTaskId) {
      if (!nextTaskIdMap.has(task.nextTaskId)) {
        nextTaskIdMap.set(task.nextTaskId, []);
      }
      nextTaskIdMap.get(task.nextTaskId).push(task.id);
    }
  });
  
  // Report if multiple tasks point to the same nextTaskId (potential branching)
  nextTaskIdMap.forEach((sourceIds, targetId) => {
    if (sourceIds.length > 1) {
      warning(`Multiple tasks point to task "${targetId}": ${sourceIds.join(', ')} (possible branching)`);
    }
  });
  
  // 4. Check for unused images
  const unusedImages = [...availableImages].filter(img => !usedImages.has(img));
  if (unusedImages.length > 0) {
    warning(`${unusedImages.length} unused images: ${unusedImages.slice(0, 5).join(', ')}${unusedImages.length > 5 ? '...' : ''}`);
  }
  
  // Summary
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(`${GREEN}${BOLD}✓ ${filename} validation passed${RESET}`);
  } else {
    console.log(`${YELLOW}${BOLD}⚠ ${filename} validation completed with issues${RESET}`);
  }
}

/**
 * Main
 */
function main() {
  console.log(`${BOLD}${BLUE}🔍 City Alert Mission Data Validator${RESET}\n`);
  
  const tasksDir = path.join(__dirname, '../v1/tasks');
  
  // Get mission files to validate
  const args = process.argv.slice(2);
  let missionFiles = [];
  
  if (args.length > 0) {
    // Validate specific files
    missionFiles = args;
  } else {
    // Validate all JSON files
    if (!fs.existsSync(tasksDir)) {
      console.error(`${RED}Error: Tasks directory not found: ${tasksDir}${RESET}`);
      process.exit(1);
    }
    
    missionFiles = fs.readdirSync(tasksDir)
      .filter(f => f.endsWith('.json') && !f.includes('_copy'));
  }
  
  if (missionFiles.length === 0) {
    console.warn(`${YELLOW}No mission files found to validate${RESET}`);
    process.exit(0);
  }
  
  info(`Validating ${missionFiles.length} mission file(s)...`);
  
  // Validate each mission
  missionFiles.forEach(filename => {
    const challengeCode = filename.replace('.json', '');
    validateMission(filename, challengeCode);
  });
  
  // Final summary
  console.log(`\n${BOLD}═══════════════════════════════════════${RESET}`);
  if (totalErrors > 0) {
    console.log(`${RED}${BOLD}❌ Validation FAILED${RESET}`);
    console.log(`   ${RED}${totalErrors} error(s)${RESET}`);
    if (totalWarnings > 0) {
      console.log(`   ${YELLOW}${totalWarnings} warning(s)${RESET}`);
    }
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(`${YELLOW}${BOLD}⚠ Validation PASSED with warnings${RESET}`);
    console.log(`   ${YELLOW}${totalWarnings} warning(s)${RESET}`);
    process.exit(0);
  } else {
    console.log(`${GREEN}${BOLD}✅ All validations PASSED${RESET}`);
    process.exit(0);
  }
}

// Run
main();

