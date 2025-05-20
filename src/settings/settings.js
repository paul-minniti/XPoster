document.addEventListener("DOMContentLoaded", async () => {
  const systemPromptTextarea = document.getElementById("systemPrompt");
  const charCounterSpan = document.getElementById("charCounter");

  const apiKeyInput = document.getElementById("apiKey");
  const settingsForm = document.getElementById("settingsForm");
  const resetButton = document.getElementById("resetSettings");
  const testButton = document.getElementById("testConnection"); // Keep for 11.4
  const statusMessageDiv = document.getElementById("statusMessage");

  if (systemPromptTextarea && charCounterSpan) {
    const updateCounter = () => {
      const currentLength = systemPromptTextarea.value.length;
      charCounterSpan.textContent = `${currentLength}`;
      charCounterSpan.style.color = "#555"; // Keep default color
    };

    systemPromptTextarea.addEventListener("input", updateCounter);

    // Initial update will be triggered after loading settings
  }

  // --- Helper function for status messages ---
  function showStatusMessage(message, isError = false) {
    if (statusMessageDiv) {
      statusMessageDiv.textContent = message;
      statusMessageDiv.className = "status-message"; // Reset
      if (isError) {
        statusMessageDiv.classList.add("error");
      } else {
        statusMessageDiv.classList.add("success");
      }
      setTimeout(() => {
        statusMessageDiv.textContent = "";
        statusMessageDiv.className = "status-message";
      }, 4000); // Increased duration slightly for better readability
    }
  }

  // --- Load existing settings on page load ---
  async function loadAndDisplaySettings() {
    try {
      if (typeof loadSettingsFromStorage !== "function") {
        showStatusMessage("Error: Storage functions not loaded.", true);
        console.error(
          "loadSettingsFromStorage is not defined. Ensure storage.js is loaded correctly before settings.js."
        );
        return;
      }
      const settings = await loadSettingsFromStorage();
      if (apiKeyInput) {
        apiKeyInput.value = settings.apiKey || "";
      }
      if (systemPromptTextarea) {
        systemPromptTextarea.value = settings.systemPrompt || "";
        systemPromptTextarea.dispatchEvent(new Event("input")); // Update char counter
      }
      console.log("Settings loaded into form.");
    } catch (error) {
      console.error("Failed to load settings:", error);
      showStatusMessage(
        `Error loading settings: ${error.message || error}`,
        true
      );
    }
  }

  // --- Handle Save Settings ---
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
      const systemPrompt = systemPromptTextarea
        ? systemPromptTextarea.value
        : "";

      if (apiKeyInput && apiKeyInput.required && !apiKey) {
        showStatusMessage("API Key is required.", true);
        apiKeyInput.focus();
        return;
      }

      showStatusMessage("Saving settings...", false);
      try {
        if (typeof saveSettingsToStorage !== "function") {
          showStatusMessage("Error: Storage functions not loaded.", true);
          console.error(
            "saveSettingsToStorage is not defined. Ensure storage.js is loaded correctly before settings.js."
          );
          return;
        }
        await saveSettingsToStorage(apiKey, systemPrompt);
        showStatusMessage("Settings saved successfully!", false);
      } catch (error) {
        console.error("Failed to save settings:", error);
        showStatusMessage(
          `Error saving settings: ${error.message || error}`,
          true
        );
      }
    });
  }

  // --- Handle Reset to Defaults ---
  if (resetButton) {
    resetButton.addEventListener("click", async () => {
      const confirmReset = confirm(
        "Are you sure you want to reset all settings to their defaults? This will clear your API key and custom system prompt."
      );
      if (confirmReset) {
        if (apiKeyInput) apiKeyInput.value = "";
        if (systemPromptTextarea) {
          systemPromptTextarea.value = "";
          systemPromptTextarea.dispatchEvent(new Event("input")); // Update counter
        }

        showStatusMessage("Resetting settings...", false);
        try {
          if (typeof saveSettingsToStorage !== "function") {
            showStatusMessage("Error: Storage functions not loaded.", true);
            console.error(
              "saveSettingsToStorage is not defined for reset. Ensure storage.js is loaded."
            );
            return;
          }
          await saveSettingsToStorage("", ""); // Save empty strings
          showStatusMessage("Settings reset to defaults and saved.", false);
        } catch (error) {
          console.error("Failed to reset settings in storage:", error);
          showStatusMessage(
            `Error resetting settings: ${error.message || error}`,
            true
          );
          // Attempt to load existing settings again if reset save failed
          await loadAndDisplaySettings();
        }
      }
    });
  }

  // --- Handle Test Connection Button ---
  if (testButton) {
    testButton.addEventListener("click", async () => {
      if (!apiKeyInput) return;
      const apiKey = apiKeyInput.value.trim();

      if (!apiKey) {
        showStatusMessage("Please enter an API Key to test.", true);
        apiKeyInput.focus();
        return;
      }

      // Client-side format validation first
      if (typeof validateApiKeyFormat !== "function") {
        showStatusMessage("Error: Validation functions not loaded.", true);
        console.error(
          "validateApiKeyFormat is not defined. Ensure validation.js is loaded."
        );
        return;
      }
      if (!validateApiKeyFormat(apiKey)) {
        showStatusMessage(
          "Invalid API Key format. It should start with 'sk-' and be 51 characters long.",
          true
        );
        apiKeyInput.focus();
        return;
      }

      showStatusMessage("Testing connection...");
      testButton.disabled = true;
      let result;
      try {
        if (typeof testOpenAiConnection !== "function") {
          showStatusMessage("Error: Validation functions not loaded.", true);
          console.error(
            "testOpenAiConnection is not defined. Ensure validation.js is loaded."
          );
          testButton.disabled = false;
          return;
        }
        result = await testOpenAiConnection(apiKey);
        if (result.success) {
          showStatusMessage(result.message || "Connection successful!", false);
        } else {
          showStatusMessage(
            result.error || "Test failed. Unknown error.",
            true
          );
        }
      } catch (error) {
        // This catch might be redundant if testOpenAiConnection handles all its errors and returns a structured object
        console.error("Error during test connection call:", error);
        showStatusMessage(
          `Connection Test Error: ${
            error.message || "An unexpected error occurred."
          }`,
          true
        );
      } finally {
        testButton.disabled = false;
      }
    });
  }

  // Initial load of settings
  await loadAndDisplaySettings();
});
