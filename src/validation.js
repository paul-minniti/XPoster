// validation.js - Functions for validating API key format and testing connection

/**
 * Validates the format of an OpenAI API key.
 * OpenAI keys typically start with "sk-" followed by 48 alphanumeric characters.
 * A more relaxed check is also included for "sess-" for session keys if ever needed,
 * or potentially other future prefixes by checking length primarily after a known prefix style.
 * @param {string} apiKey The API key to validate.
 * @returns {boolean} True if the format seems valid, false otherwise.
 */
function validateApiKeyFormat(apiKey) {
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    return false;
  }
  // --- Temporary Debug Logging ---
  // console.log(
  //   "Validating API Key:",
  //   "'" + apiKey + "'",
  //   "Length:",
  //   apiKey.length
  // ); // REMOVED for permanent fix
  // --- End Temporary Debug Logging ---

  // Updated regex to support standard (sk-) and project (sk-proj-) keys,
  // allowing for alphanumeric, underscore, and hyphen characters, with a minimum length for the key body.
  const openAiApiKeyRegex = /^sk-(proj-)?[a-zA-Z0-9_-]{40,}$/;

  // Standard OpenAI API key: sk- followed by 48 alphanumeric chars.
  // Total length 51 (3 + 48).
  // const openAiStandardRegex = /^sk-[a-zA-Z0-9]{48}$/; // OLD REGEX
  // A slightly more general check for keys that might have different prefixes but similar structure:
  // Example: "prefix-" + (typically 40-60 alphanumeric characters)
  // For now, we stick to the known "sk-" format.
  // if (openAiStandardRegex.test(apiKey)) {
  //     return true;
  // }
  // Add other patterns here if necessary, e.g., for Azure OpenAI keys or other services.
  return openAiApiKeyRegex.test(apiKey);
}

/**
 * Tests the connection to OpenAI API using a given API key.
 * Makes a lightweight call to the /v1/models endpoint.
 * @param {string} apiKey The API key to test.
 * @returns {Promise<{success: boolean, message?: string, error?: string, statusCode?: number}>}
 */
async function testOpenAiConnection(apiKey) {
  if (!apiKey || typeof apiKey !== "string") {
    return Promise.resolve({
      success: false,
      error: "API Key is missing or invalid.",
      statusCode: 400,
    });
  }

  const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/models";
  const TIMEOUT_DURATION = 15000; // 15 seconds

  let controller;
  let timeoutId;

  try {
    controller = new AbortController();
    const signal = controller.signal;

    timeoutId = setTimeout(() => {
      controller.abort();
    }, TIMEOUT_DURATION);

    const response = await fetch(OPENAI_API_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: signal,
    });

    clearTimeout(timeoutId); // Clear timeout if fetch completes

    if (response.ok) {
      // Status 200-299
      // const data = await response.json(); // We don't necessarily need to parse the body for a simple test
      console.log("OpenAI Connection Test: Success", response.status);
      return {
        success: true,
        message: "Connection successful! API key is valid.",
        statusCode: response.status,
      };
    } else {
      let errorMessage = `API Connection Test Failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorMessage = `API Error (${response.status}): ${errorData.error.message}`;
        } else if (errorData.message) {
          errorMessage = `API Error (${response.status}): ${errorData.message}`;
        }
      } catch (e) {
        // Ignore if parsing error body fails, use statusText
      }
      console.warn(
        "OpenAI Connection Test: Failed",
        response.status,
        errorMessage
      );
      if (response.status === 401) {
        return {
          success: false,
          error: "Invalid API Key. (Authentication Failed - 401)",
          statusCode: 401,
        };
      } else if (response.status === 403) {
        return {
          success: false,
          error: "API Key Forbidden. (Permissions Issue - 403)",
          statusCode: 403,
        };
      } else if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded. Please try again later. (429)",
          statusCode: 429,
        };
      }
      return {
        success: false,
        error: errorMessage,
        statusCode: response.status,
      };
    }
  } catch (error) {
    clearTimeout(timeoutId); // Ensure timeout is cleared on any error
    if (error.name === "AbortError") {
      console.warn(
        "OpenAI Connection Test: Timed out after",
        TIMEOUT_DURATION / 1000,
        "seconds"
      );
      return {
        success: false,
        error: `Connection timed out after ${
          TIMEOUT_DURATION / 1000
        }s. Check network or OpenAI status.`,
        statusCode: 408,
      }; // 408 Request Timeout
    } else {
      console.error("OpenAI Connection Test: Network or other error", error);
      return {
        success: false,
        error: `Network error or other issue: ${
          error.message || "Unknown error"
        }`,
      };
    }
  }
}

// Example Usage (for testing in an environment with fetch):
/*
async function runTest() {
    console.log("Format 'sk-123... (51 chars)':", validateApiKeyFormat("sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")); // true
    console.log("Format 'pk-123...':", validateApiKeyFormat("pk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")); // false
    console.log("Format 'sk-short':", validateApiKeyFormat("sk-shortkey")); // false
    console.log("Format empty:", validateApiKeyFormat("")); // false

    // Replace with a real (or intentionally fake) key to test connection
    // const testKey = "YOUR_TEST_API_KEY"; 
    // if (testKey && testKey !== "YOUR_TEST_API_KEY") {
    //     console.log(`\nTesting connection with key: ${testKey.substring(0, 6)}...`);
    //     const result = await testOpenAiConnection(testKey);
    //     console.log("Connection Test Result:", result);
    // } else {
    //     console.log("\nSkipping connection test as YOUR_TEST_API_KEY is not set.");
    // }
}
// runTest();
*/
