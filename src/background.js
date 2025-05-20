// background.js - Service Worker for Quick GPT Reply Extension

importScripts("storage.js");

// Fixed API key for MVP - REPLACE 'your-api-key-here' WITH YOUR ACTUAL KEY
// const OPENAI_API_KEY = "YOUR-API-KEY-HERE";
// API endpoint
const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";

// const apiResponseCache = {}; // Stores { reply, timestamp } or { promise, timestamp } // REMOVED
// const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes // REMOVED

// --- START: Added for Subtask 7.3 ---
const API_TIMEOUT_DURATION = 60000; // 60 seconds, adjustable
// --- END: Added for Subtask 7.3 ---

chrome.runtime.onInstalled.addListener((details) => {
  console.log("Quick GPT Reply extension installed/updated:", details);
  // Initialize default settings or perform first-time setup
  try {
    // Example: Store default settings
    // chrome.storage.sync.set({ apiKey: '' }, () => {
    //   if (chrome.runtime.lastError) {
    //     console.error('Error setting initial storage:', chrome.runtime.lastError);
    //   } else {
    //     console.log('Initial storage set.');
    //   }
    // });
    console.log("Placeholder for initializing default settings on install.");
  } catch (e) {
    console.error("Error during onInstalled:", e);
  }
});

// --- START: Added to open options page on icon click ---
chrome.action.onClicked.addListener((tab) => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    // Fallback for older versions or if openOptionsPage is not available
    const optionsUrl = chrome.runtime.getURL("src/settings/settings.html");
    chrome.tabs.create({ url: optionsUrl });
  }
});
// --- END: Added to open options page on icon click ---

// Future API Communication Logic
// -----------------------------
// Example: Function to fetch GPT suggestions (to be implemented)
// async function fetchGPTSuggestion(promptText) {
//   // ... API call logic here ...
//   // Remember to handle API keys securely and manage errors
// }

async function generateReply(tweetContent) {
  // --- START: Added for Subtask 11.5 ---
  if (typeof loadSettingsFromStorage !== "function") {
    console.error(
      "CRITICAL: loadSettingsFromStorage is not defined. storage.js might not be imported correctly."
    );
    throw new Error(
      "Failed to load extension settings. Please try reloading the extension."
    );
  }
  const { apiKey: loadedApiKey, systemPrompt: userSystemPrompt } =
    await loadSettingsFromStorage();

  if (!loadedApiKey) {
    console.error("API Key not configured in extension settings.");
    throw new Error(
      "API Key not configured. Please set it via the extension options page."
    );
  }
  // --- END: Added for Subtask 11.5 ---

  console.log(
    "Background: Fetching from API for:", // Simplified log, always fetches
    tweetContent
  );

  const makeApiCall = async (currentApiKey, isRetry = false) => {
    if (isRetry) {
      console.warn(`Retrying API call for ${tweetContent}`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retry
    }

    // --- START: Modified for Subtask 7.3 (Promise.race with timeout) ---
    const fetchPromise = fetch(OPENAI_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              userSystemPrompt && userSystemPrompt.trim() !== ""
                ? userSystemPrompt
                : await fetch(chrome.runtime.getURL("systemPrompt.txt")).then(
                    (r) => r.text()
                  ),
          },
          {
            role: "user",
            content: `Generate a reply to this tweet: \"${tweetContent}\"`,
          },
        ],
      }),
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              "API request timed out after " +
                API_TIMEOUT_DURATION / 1000 +
                " seconds"
            )
          ),
        API_TIMEOUT_DURATION
      );
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    // --- END: Modified for Subtask 7.3 (Promise.race with timeout) ---

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      console.error(
        `API request ${isRetry ? "retry " : ""}failed:`,
        response.status,
        errorData
      );

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `API Authentication Error (Status ${response.status}): Invalid API Key or insufficient permissions. Please check your API key configuration.`
        );
      } else if (response.status === 429) {
        throw new Error(
          `API Rate Limit Exceeded (Status ${response.status}): Too many requests. Please try again later.`
        );
      } else {
        // For other errors, we might retry (only once if it's the initial call)
        // If it was a timeout, error.isRetryable will be undefined, so it won't retry, which is correct.
        throw {
          isRetryable:
            !isRetry &&
            !(
              response instanceof Error &&
              response.message.startsWith("API request timed out")
            ), // Only allow one retry attempt and not for timeout
          status: response.status, // Might be undefined if it's a timeout error object
          data: errorData, // Might be undefined if it's a timeout error object
          message:
            response instanceof Error &&
            response.message.startsWith("API request timed out")
              ? response.message
              : `API request failed with status ${response.status}: ${
                  errorData.error?.message ||
                  errorData.message ||
                  "Unknown error"
                }`,
        };
      }
    }

    const data = await response.json();
    if (
      data.choices &&
      data.choices.length > 0 &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      let reply = data.choices[0].message.content.trim(); // Get the raw reply

      // --- START: Added to remove surrounding quotes from reply ---
      const originalReplyForLog = reply; // For logging comparison
      if (
        reply.length >= 2 &&
        ((reply.startsWith('"') && reply.endsWith('"')) ||
          (reply.startsWith("'") && reply.endsWith("'")))
      ) {
        reply = reply.slice(1, -1).trim(); // Remove first and last char, then re-trim
        console.log(
          "Quick GPT Reply (Background): Removed surrounding quotes. Original:",
          '"' + originalReplyForLog + '"',
          "Cleaned:",
          reply
        );
      }
      // --- END: Added to remove surrounding quotes from reply ---

      console.log(
        "Background: API response received",
        isRetry ? "on retry " : "",
        "for:",
        tweetContent,
        "Processed reply:",
        reply
      );
      return reply;
    } else {
      console.error(
        `Invalid API response structure ${isRetry ? "on retry " : ""}:`,
        data
      );
      throw new Error(
        `Invalid API response structure ${
          isRetry ? "on retry" : ""
        }. No valid choice found.`
      );
    }
  };

  try {
    return await makeApiCall(loadedApiKey);
  } catch (error) {
    if (error.isRetryable) {
      // This is the first attempt that failed and is marked as retryable
      console.warn(
        "Background: Initial API call failed, attempting one retry for:",
        tweetContent,
        error.message
      );
      // The makeApiCall function will handle the actual retry logic including delay
      return await makeApiCall(loadedApiKey, true); // Pass true to indicate it's a retry attempt
    }
    // If not retryable, or if it was already a retry that failed, re-throw the error
    console.error(
      "Background: API call failed (either not retryable or retry failed) for:",
      tweetContent,
      error.message || error
    );
    throw error; // Re-throw to be caught by the message listener's catch block
  }
}

// Message Listeners (e.g., from content scripts)
// ---------------------------------------------
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "getSuggestion") {
//     // Call fetchGPTSuggestion and send response
//     // sendResponse({ suggestion: 'AI suggestion here...' });
//     // return true; // To indicate asynchronous response
//   }
// });

console.log("Background: Attempting to add onMessage listener...");
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(
    "Background: Message received in listener:",
    message,
    "from sender:",
    sender
  );

  if (message.action === "generateReply" && message.tweetContent) {
    console.log(
      "Background: Received generateReply request with content:",
      message.tweetContent
    );
    generateReply(message.tweetContent)
      .then((reply) => {
        console.log("Background: Sending success response with reply:", reply);
        sendResponse({ success: true, reply: reply });
      })
      .catch((error) => {
        console.error(
          "Background: Error in generateReply, sending error response:",
          error.message
        );
        sendResponse({
          success: false,
          error: error.message || "Unknown error from generateReply",
        });
      });
    return true; // Indicate we will send a response asynchronously
  } else if (message.action === "generateReply") {
    console.log(
      "Background: 'generateReply' action received, but no tweetContent. Sending error."
    );
    sendResponse({
      success: false,
      error: "tweetContent missing in generateReply request",
    });
    // For a synchronous response like this, returning false or nothing is fine.
    // However, to be explicit and avoid potential issues if more logic were added,
    // we can return false.
    return false;
  } else {
    console.log("Background: Received unknown action:", message.action);
    sendResponse({
      success: false,
      error: "Unknown action received by background script",
    });
    return false; // Synchronous response
  }
});
console.log("Background: onMessage listener ADDED.");

console.log("Background service worker started.");
