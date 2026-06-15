/**
 * App Configuration Loader
 * Reads ~/.pixel-agent-desk/config.json to load user preferences
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function getAppConfig() {
  const configPath = path.join(os.homedir(), '.pixel-agent-desk', 'config.json');
  const defaultConfig = {
    integrations: {
      claude: {
        enabled: true
      }
    }
  };

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        integrations: {
          claude: {
            enabled: parsed?.integrations?.claude?.enabled !== false
          }
        }
      };
    }
  } catch (e) {
    // Fail silently, fallback to defaults
  }

  return defaultConfig;
}

module.exports = { getAppConfig };
