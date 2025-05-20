// storage.js - Handles saving and loading settings using chrome.storage.local

/**
 * Saves the API key (Base64 encoded) and system prompt to chrome.storage.local.
 * @param {string} apiKey - The OpenAI API key.
 * @param {string} systemPrompt - The custom system prompt.
 * @returns {Promise<void>} A promise that resolves on success or rejects on error.
 */
async function saveSettingsToStorage(apiKey, systemPrompt) {
  const settingsToSave = {};

  if (typeof apiKey === "string" && apiKey.trim() !== "") {
    try {
      settingsToSave.userApiKey = btoa(apiKey.trim()); // Base64 encode
    } catch (e) {
      console.error("Error Base64 encoding API key:", e);
      return Promise.reject("Failed to encode API key.");
    }
  } else if (apiKey === null || apiKey.trim() === "") {
    // If apiKey is explicitly set to empty or null, store it as such (to allow clearing it)
    settingsToSave.userApiKey = ""; // Store empty string to represent no key / cleared key
  }
  // If apiKey is undefined, we don't add userApiKey to settingsToSave, leaving it unchanged in storage
  // Or, if the intention is to always save *something* for apiKey if it's passed:
  // else if (typeof apiKey === 'string') { // handles empty string explicitly if desired
  //    settingsToSave.userApiKey = '';
  // }

  if (typeof systemPrompt === "string") {
    settingsToSave.userSystemPrompt = systemPrompt; // Save plain text
  }
  // If systemPrompt is undefined, we don't add userSystemPrompt to settingsToSave

  if (Object.keys(settingsToSave).length === 0) {
    // Nothing to save if both apiKey and systemPrompt are undefined or invalid
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set(settingsToSave, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error saving settings to storage:",
          chrome.runtime.lastError.message
        );
        reject(`Error saving settings: ${chrome.runtime.lastError.message}`);
      } else {
        console.log("Settings saved successfully:", settingsToSave);
        resolve();
      }
    });
  });
}

/**
 * Loads the API key (Base64 decoded) and system prompt from chrome.storage.local.
 * @returns {Promise<{apiKey: string, systemPrompt: string}>} A promise that resolves with an object containing the apiKey and systemPrompt.
 */
async function loadSettingsFromStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["userApiKey", "userSystemPrompt"], (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error loading settings from storage:",
          chrome.runtime.lastError.message
        );
        reject(`Error loading settings: ${chrome.runtime.lastError.message}`);
        return;
      }

      let decodedApiKey = "";
      if (
        result.userApiKey &&
        typeof result.userApiKey === "string" &&
        result.userApiKey !== ""
      ) {
        try {
          decodedApiKey = atob(result.userApiKey); // Base64 decode
        } catch (e) {
          console.error(
            "Error Base64 decoding API key:",
            e,
            "Stored value:",
            result.userApiKey
          );
          // Don't reject, but return empty key and log error.
          // This handles cases of corrupted stored data gracefully by falling back to an empty key.
          decodedApiKey = "";
        }
      }

      const systemPrompt = result.userSystemPrompt || "";

      console.log("Settings loaded successfully:", {
        apiKey: decodedApiKey ? "***" : "",
        systemPrompt,
      });
      resolve({ apiKey: decodedApiKey, systemPrompt });
    });
  });
}

// Example usage (for testing in a context where chrome.storage is available):
/*
async function testStorage() {
    try {
        console.log('Testing settings save...');
        await saveSettingsToStorage('test-api-key-123', 'Be very concise.');
        let settings = await loadSettingsFromStorage();
        console.log('Loaded settings after save:', settings);

        console.log('Testing clearing API key...');
        await saveSettingsToStorage('', 'New prompt, key cleared.');
        settings = await loadSettingsFromStorage();
        console.log('Loaded settings after clearing key:', settings);

        console.log('Testing saving only system prompt...');
        await saveSettingsToStorage(undefined, 'Only system prompt updated.');
        settings = await loadSettingsFromStorage();
        console.log('Loaded settings after saving only prompt:', settings);

        console.log('Testing saving only API key...');
        await saveSettingsToStorage('another-key-456', undefined);
        settings = await loadSettingsFromStorage();
        console.log('Loaded settings after saving only API key:', settings);

    } catch (error) {
        console.error('Storage test failed:', error);
    }
}
// testStorage(); // Uncomment to run test if in appropriate environment
*/
