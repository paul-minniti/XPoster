// content.js - Script for interacting with X.com (Twitter) DOM

console.log("Quick GPT Reply content script loaded.");

// Helper function to check if an element is visible
function isElementVisible(element) {
  if (!element) return false;
  // Check if the element has dimensions and is not hidden by display:none or visibility:hidden
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  // Check for offsetWidth/offsetHeight, which are 0 for hidden elements (unless fixed position and off-screen)
  // Also check getClientRects for elements that might not have width/height but are rendered (e.g. inline elements, SVGs)
  return !!(
    element.offsetWidth ||
    element.offsetHeight ||
    element.getClientRects().length
  );
}

// --- START: Added for Subtask 7.1 ---
let spinnerStylesInjected = false;
function injectSpinnerStyles() {
  if (spinnerStylesInjected) return;

  const style = document.createElement("style");
  style.textContent = `
    .quick-reply-spinner {
      border: 2px solid #f0f0f0; /* Light grey */
      border-top: 2px solid #1da1f2; /* Blue from button */
      border-radius: 50%;
      width: 12px;
      height: 12px;
      animation: quick-reply-spin 0.8s linear infinite;
      display: inline-block;
      vertical-align: middle;
      margin-right: 6px; /* Space between spinner and text if both were visible */
    }

    @keyframes quick-reply-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  spinnerStylesInjected = true;
  console.log("Quick GPT Reply: Spinner styles injected.");
}
// --- END: Added for Subtask 7.1 ---

function handleQuickReplyClick(event) {
  // Prevent default button action and stop event propagation
  event.preventDefault();
  event.stopPropagation();

  const button = event.currentTarget;
  const buttonTextSpan = button.querySelector(".quick-reply-button-text");
  const spinnerElement = button.querySelector(".quick-reply-spinner");
  const originalButtonText = buttonTextSpan
    ? buttonTextSpan.textContent
    : "Quick Reply"; // Fallback
  const originalButtonBackgroundColor = button.style.backgroundColor; // Store original background for reset

  // Function to reset the button state
  function resetButton(btn, textSpan, spinner, originalText, originalBgColor) {
    // Added originalBgColor
    if (btn) {
      if (textSpan) {
        textSpan.textContent = originalText;
        textSpan.style.display = "inline";
      }
      if (spinner) {
        spinner.style.display = "none";
      }
      btn.style.backgroundColor = originalBgColor; // Reset background color
      btn.disabled = false;
    }
  }

  // --- Loading State Start ---
  if (buttonTextSpan) buttonTextSpan.style.display = "none";
  if (spinnerElement) spinnerElement.style.display = "inline-block";
  button.disabled = true;
  // -------------------------

  console.log("Quick GPT Reply button clicked:", button);

  // Subtask 3.1: Identify the tweet element
  let tweetElement = button.closest("article");

  if (!tweetElement) {
    console.warn(
      "Quick GPT Reply: Could not find parent 'article' element. Trying fallback [data-testid=\"tweet\"]"
    );
    tweetElement = button.closest('[data-testid="tweet"]');
  }

  if (tweetElement) {
    console.log("Found tweet element:", tweetElement);
    try {
      const tweetData = extractTweetContext(tweetElement);
      if (tweetData && (tweetData.text || tweetData.mediaInfo.length > 0)) {
        console.log("Extracted tweet data:", tweetData);
        chrome.runtime.sendMessage(
          { action: "generateReply", tweetContent: tweetData.text },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Quick GPT Reply: Error sending message:",
                chrome.runtime.lastError.message
              );
              alert(
                `Quick GPT Reply Error: ${chrome.runtime.lastError.message}`
              );
              // --- START: Modified for Subtask 7.2 (Error State) ---
              if (buttonTextSpan) {
                buttonTextSpan.textContent = "Error";
                buttonTextSpan.style.display = "inline";
              }
              if (spinnerElement) spinnerElement.style.display = "none";
              button.style.backgroundColor = "#FF6B6B"; // Reddish error color
              button.disabled = true; // Keep disabled during error display
              setTimeout(() => {
                resetButton(
                  button,
                  buttonTextSpan,
                  spinnerElement,
                  originalButtonText,
                  originalButtonBackgroundColor
                );
              }, 2000); // Show error state for 2 seconds
              // --- END: Modified for Subtask 7.2 (Error State) ---
              return;
            }

            if (response && response.success) {
              console.log("Quick GPT Reply received:", response.reply);
              // Pass original tweet text (tweetData.text) to injectReply for the regenerate button
              injectReply(tweetElement, response.reply, tweetData.text);
              // Reset after successful injection (or if injectReply handles its own errors and button state)
              resetButton(
                button,
                buttonTextSpan,
                spinnerElement,
                originalButtonText,
                originalButtonBackgroundColor
              );
            } else {
              const errorMessage =
                response?.error || "Unknown error generating reply.";
              console.error(
                "Quick GPT Reply: Failed to generate reply:",
                errorMessage
              );
              alert(`Quick GPT Reply Error: ${errorMessage}`);
              // --- START: Modified for Subtask 7.2 (Error State) ---
              if (buttonTextSpan) {
                buttonTextSpan.textContent = "Error";
                buttonTextSpan.style.display = "inline";
              }
              if (spinnerElement) spinnerElement.style.display = "none";
              button.style.backgroundColor = "#FF6B6B"; // Reddish error color
              button.disabled = true; // Keep disabled during error display
              setTimeout(() => {
                resetButton(
                  button,
                  buttonTextSpan,
                  spinnerElement,
                  originalButtonText,
                  originalButtonBackgroundColor
                );
              }, 2000); // Show error state for 2 seconds
              // --- END: Modified for Subtask 7.2 (Error State) ---
            }
            // Original direct reset is removed from here, handled above or after success.
          }
        );
      } else {
        console.warn(
          "Quick GPT Reply: Could not extract tweet content or context."
        );
        // --- START: Modified for Subtask 7.2 (Error State) ---
        if (buttonTextSpan) {
          buttonTextSpan.textContent = "Error";
          buttonTextSpan.style.display = "inline";
        }
        if (spinnerElement) spinnerElement.style.display = "none";
        button.style.backgroundColor = "#FF6B6B";
        button.disabled = true;
        setTimeout(() => {
          resetButton(
            button,
            buttonTextSpan,
            spinnerElement,
            originalButtonText,
            originalButtonBackgroundColor
          );
        }, 2000);
        // --- END: Modified for Subtask 7.2 (Error State) ---
      }
    } catch (e) {
      console.error("Quick GPT Reply: Error during tweet data extraction:", e);
      // --- START: Modified for Subtask 7.2 (Error State) ---
      if (buttonTextSpan) {
        buttonTextSpan.textContent = "Error";
        buttonTextSpan.style.display = "inline";
      }
      if (spinnerElement) spinnerElement.style.display = "none";
      button.style.backgroundColor = "#FF6B6B";
      button.disabled = true;
      setTimeout(() => {
        resetButton(
          button,
          buttonTextSpan,
          spinnerElement,
          originalButtonText,
          originalButtonBackgroundColor
        );
      }, 2000);
      // --- END: Modified for Subtask 7.2 (Error State) ---
    }
  } else {
    console.error(
      "Quick GPT Reply: Could not find the parent tweet element from the button after fallbacks."
    );
    // --- START: Modified for Subtask 7.2 (Error State) ---
    if (buttonTextSpan) {
      buttonTextSpan.textContent = "Error";
      buttonTextSpan.style.display = "inline";
    }
    if (spinnerElement) spinnerElement.style.display = "none";
    button.style.backgroundColor = "#FF6B6B";
    button.disabled = true;
    setTimeout(() => {
      resetButton(
        button,
        buttonTextSpan,
        spinnerElement,
        originalButtonText,
        originalButtonBackgroundColor
      );
    }, 2000);
    // --- END: Modified for Subtask 7.2 (Error State) ---
  }

  // The direct reset below is no longer needed as states are handled within specific paths (success/error)
  // --- Reset Button State (simulating end of operation) ---
  // This will eventually be tied to the completion of the AI call (Task 4+)
  // setTimeout(() => { // Remove the old timeout-based reset
  //   // Simulate a delay for now
  //   button.textContent = originalButtonText;
  //   button.disabled = false;
  // }, 1000); // Adjust delay as needed, or remove when real async ops are in place
  // ------------------------------------------------------
}

// Subtask 3.2 & 3.3: Extract Tweet Text and Context
function extractTweetContext(tweetElement) {
  if (!tweetElement) return null;

  let tweetData = {
    text: null,
    username: null,
    userHandle: null,
    timestamp: null,
    tweetUrl: null,
    mediaInfo: [], // For Subtask 3.4: stores { type: 'image'/'video'/'gif'/'link', url?, title?, count? }
  };

  // Extract Username, Handle, and Timestamp
  // User information is often in a block with data-testid="User-Name"
  const userNameGroup = tweetElement.querySelector('[data-testid="User-Name"]');
  if (userNameGroup) {
    // The first span is often the display name, the second the @handle
    // This can be fragile; more specific selectors within User-Name might be needed.
    const spans = userNameGroup.querySelectorAll("span");
    if (spans && spans.length > 0) {
      // Username (Display Name) - often the first visually prominent span
      // We'll take the first span that is not the time element or the handle
      for (let span of spans) {
        if (
          span.textContent &&
          !span.textContent.startsWith("@") &&
          !span.closest("time")
        ) {
          tweetData.username = span.textContent.trim();
          break;
        }
      }
      // User Handle - often starts with '@'
      const handleSpan = Array.from(spans).find(
        (s) => s.textContent && s.textContent.startsWith("@")
      );
      if (handleSpan) {
        tweetData.userHandle = handleSpan.textContent.trim();
      }
    }
  }

  // Timestamp and Tweet URL
  // Usually in an <a> tag containing a <time> element with a datetime attribute
  const timeLinkElement = tweetElement.querySelector("a time[datetime]");
  if (timeLinkElement && timeLinkElement.parentElement.tagName === "A") {
    tweetData.timestamp = timeLinkElement.getAttribute("datetime");
    tweetData.tweetUrl = timeLinkElement.parentElement.href;
  } else {
    // Fallback if time is not in an A tag, just get datetime
    const timeElementOnly = tweetElement.querySelector("time[datetime]");
    if (timeElementOnly) {
      tweetData.timestamp = timeElementOnly.getAttribute("datetime");
    }
  }

  // Primary selector for tweet text
  let textElement = tweetElement.querySelector('[data-testid="tweetText"]');

  if (textElement) {
    const clonedTextElement = textElement.cloneNode(true);
    // Remove any link previews or quote tweets that might be physically inside the tweetText container
    // but are visually separate and will be handled by media detection.
    clonedTextElement
      .querySelectorAll('a[href*="/status/"] > div[role="link"]')
      .forEach((el) => el.remove()); // quote tweet embeds
    clonedTextElement
      .querySelectorAll('div[data-testid="card.wrapper"]')
      .forEach((el) => el.remove()); // card link previews

    clonedTextElement
      .querySelectorAll('span[aria-hidden="true"]')
      .forEach((el) => el.remove());
    let rawText = clonedTextElement.textContent || "";
    tweetData.text = rawText.replace(/\s+/g, " ").trim();
  }
  // Note: Media detection will run regardless of textElement presence,
  // as tweets can have text AND media, or just media.

  // Subtask 3.4: Media Content Detection
  // Images
  const imageElements = tweetElement.querySelectorAll(
    'div[data-testid="tweetPhoto"] img[alt]:not([alt=""]) '
  ); // Look for images with alt text
  if (imageElements.length > 0) {
    tweetData.mediaInfo.push({ type: "image", count: imageElements.length });
  }

  // Videos / GIFs
  // Twitter uses similar structures for videos and GIFs, often with a [data-testid="videoPlayer"]
  const videoPlayerElements = tweetElement.querySelectorAll(
    'div[data-testid="videoPlayer"]'
  );
  if (videoPlayerElements.length > 0) {
    // Could try to differentiate GIF vs Video if specific attributes exist, for now, just 'video'
    tweetData.mediaInfo.push({
      type: "video",
      count: videoPlayerElements.length,
    });
  }

  // External Links (Cards)
  // Twitter renders links often as "cards" with previews
  const cardWrappers = tweetElement.querySelectorAll(
    'div[data-testid="card.wrapper"]'
  );
  cardWrappers.forEach((card) => {
    const linkElement = card.querySelector("a[href]");
    if (linkElement) {
      let linkUrl = linkElement.href;
      // Sometimes the link in the card is a t.co shortened URL, try to get the resolved one
      const vanillaLink = linkElement.querySelector('span[dir="ltr"]'); // Heuristic for a more direct link text
      if (vanillaLink && vanillaLink.textContent.includes("."))
        linkUrl = vanillaLink.textContent; // if it looks like a domain

      let linkTitle = "";
      // Try to find a title within the card, selectors might vary
      const titleElement = card.querySelector(
        'div[data-testid="card.layoutLarge.media"] + div > div > span, div[data-testid="card.layoutSmall.media"] + div > div > span'
      );
      if (titleElement) {
        linkTitle = titleElement.textContent.trim();
      }
      tweetData.mediaInfo.push({
        type: "link",
        url: linkUrl,
        title: linkTitle,
      });
    }
  });

  // Quote Tweets (as a special type of link/embed)
  const quoteTweetLinks = tweetElement.querySelectorAll(
    'a[href*="/status/"] > div[role="link"]'
  );
  quoteTweetLinks.forEach((qtLinkElement) => {
    const href = qtLinkElement.parentElement.href;
    if (href) {
      // Check if this quote tweet is already captured by cardWrappers or similar to avoid duplication
      // For now, we add it. Refinement might be needed.
      tweetData.mediaInfo.push({ type: "quote_tweet", url: href });
    }
  });

  // If no text was extracted AND media was found, set text to a generic placeholder
  if (!tweetData.text && tweetData.mediaInfo.length > 0) {
    tweetData.text = "[media]"; // Generic placeholder if primary text is empty but media exists
  }

  // If username or handle is still missing, try another common structure
  // where user info is in a link within the header of the tweet
  if (!tweetData.username || !tweetData.userHandle) {
    const userLinkInHeader = tweetElement.querySelector(
      'div[data-testid="tweetPhoto"] + div a[href^="/"][role="link"]'
    );
    if (userLinkInHeader) {
      const displayNameEl = userLinkInHeader.querySelector(
        "div > div > span > span"
      );
      const handleEl = userLinkInHeader.querySelector(
        "div > div + div > div > span"
      );
      if (displayNameEl && !tweetData.username)
        tweetData.username = displayNameEl.textContent.trim();
      if (
        handleEl &&
        !tweetData.userHandle &&
        handleEl.textContent.startsWith("@")
      ) {
        tweetData.userHandle = handleEl.textContent.trim();
      }
    }
  }

  // Basic check for any content being extracted
  if (
    tweetData.text ||
    tweetData.username ||
    tweetData.userHandle ||
    tweetData.timestamp ||
    tweetData.mediaInfo.length > 0
  ) {
    return tweetData;
  }

  return null;
}

// Function to populate the reply box (Subtask 5.4)
async function injectReply(
  tweetElement,
  replyText,
  originalTweetTextForRegeneration
) {
  try {
    if (!tweetElement || !replyText) {
      console.error(
        "Quick GPT Reply: Missing tweet element or reply text for injectReply."
      );
      return;
    }

    console.log("Quick GPT Reply: Attempting to inject reply:", replyText);

    console.log("into tweet:", tweetElement);

    // 1. Find and click the native reply button for the specific tweet
    // Reverted to data-testid based selector, targeting a BUTTON element.
    const nativeReplyButton = tweetElement.querySelector(
      'button[data-testid="reply"]'
    );

    if (nativeReplyButton) {
      nativeReplyButton.click();
    } else {
      console.error(
        'Quick GPT Reply: Could not find native reply button (button[data-testid="reply"]) for the tweet.'
      );
      return;
    }

    // Wait for the modal to appear
    let tweetModal = null;
    let modalAttempts = 0;
    const maxModalAttempts = 20; // 2 seconds
    const modalSelector = 'div[role="dialog"][aria-modal="true"]'; // <<<< WE NEED THIS SELECTOR FROM YOU

    while (modalAttempts < maxModalAttempts) {
      tweetModal = document.querySelector(modalSelector); // Or a more specific selector for the tweet composer modal
      if (tweetModal && isElementVisible(tweetModal)) {
        // isElementVisible is a helper we might need
        console.log("Quick GPT Reply: Found active tweet modal:", tweetModal);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      modalAttempts++;
    }

    if (!tweetModal) {
      console.error("Quick GPT Reply: Could not find the active tweet modal.");
      return;
    }

    // Now search for the textarea *within* the found modal
    let replyTextarea = null;
    const textareaSelector = 'div[data-testid="tweetTextarea_0"]';
    let attempts = 0; // Reset attempts for textarea search
    const maxAttempts = 20; // maxAttempts for textarea can be shorter
    while (attempts < maxAttempts) {
      replyTextarea = tweetModal.querySelector(textareaSelector);
      if (replyTextarea && isElementVisible(replyTextarea)) {
        console.log(
          "Quick GPT Reply: Found reply textarea INSIDE MODAL:",
          replyTextarea
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (!replyTextarea) {
      console.error(
        "Quick GPT Reply: Could not find reply textarea INSIDE MODAL using selector:",
        textareaSelector
      );
      return;
    }

    // 3. Set the value of the textarea and dispatch events
    replyTextarea.focus(); // Focus the main contenteditable container

    // --- START: Modified for Subtask (Simulate Paste Event) ---
    try {
      // 1. Create a DataTransfer object and add the reply text.
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", replyText);
      // For HTML content, you could use: dataTransfer.setData('text/html', replyTextHTML);

      // 2. Dispatch a 'paste' event with the constructed clipboardData.
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer, // Attach the data
      });
      replyTextarea.dispatchEvent(pasteEvent);
      console.log("Quick GPT Reply: Dispatched 'paste' event with data.");

      // 3. Follow up with 'input' and 'change' events.
      // These are often necessary to trigger UI updates in frameworks like React.
      const inputEvent = new Event("input", {
        bubbles: true,
        cancelable: true,
      });
      replyTextarea.dispatchEvent(inputEvent);

      const changeEvent = new Event("change", {
        bubbles: true,
        cancelable: true,
      });
      replyTextarea.dispatchEvent(changeEvent);

      console.log(
        "Quick GPT Reply: Reply text injected via simulated paste, and input/change events dispatched."
      );
    } catch (e) {
      console.error(
        "Quick GPT Reply: Error during simulated paste event dispatch:",
        e
      );
      // Fallback to simpler text setting if paste simulation fails for any reason
      replyTextarea.textContent = replyText;
      const inputEvent = new Event("input", {
        bubbles: true,
        cancelable: true,
      });
      replyTextarea.dispatchEvent(inputEvent);
      console.warn(
        "Quick GPT Reply: Fell back to textContent + input event after paste simulation error."
      );
    }
    // --- END: Modified for Subtask (Simulate Paste Event) ---

    // Check button state
    if (tweetModal) {
      // tweetModal was found earlier in the function
      const modalPostButton = tweetModal.querySelector(
        'button[data-testid="tweetButton"]'
      ); // Target button within the modal
      if (modalPostButton) {
        console.log(
          "Quick GPT Reply: Post button in modal found. Disabled state:",
          modalPostButton.getAttribute("aria-disabled")
        );
        // We are relying on the dispatched events to enable the button naturally.
        // If still disabled, the events were not sufficient to update X.com's component state.

        // --- START: Added for Task 12 (Regenerate Button UI) ---
        // Check if a regenerate button already exists to avoid duplicates
        if (!tweetModal.querySelector(".quick-gpt-regenerate-button")) {
          const regenerateButton = createRegenerateButton(
            tweetModal,
            replyTextarea,
            originalTweetTextForRegeneration
          ); // Use passed originalTweetText

          // New placement: Next to the main reply button
          const replyButtonContainer = modalPostButton.parentElement;
          if (replyButtonContainer) {
            replyButtonContainer.insertBefore(
              regenerateButton,
              modalPostButton
            );
            // Adjust styling for the new position
            regenerateButton.style.marginRight = "8px";
            regenerateButton.style.marginTop = "0px";
            regenerateButton.style.marginBottom = "0px";
            regenerateButton.style.marginLeft = "0px"; // Ensure no other horizontal margins interfere
            console.log(
              "Quick GPT Reply: Regenerate button injected next to main reply button."
            );
          } else {
            // Fallback to old placement if the expected container isn't found (should be rare)
            console.warn(
              "Quick GPT Reply: Could not find reply button container. Falling back to old placement for regenerate button."
            );
            const textareaParent = replyTextarea.parentElement;
            if (textareaParent) {
              textareaParent.insertAdjacentElement(
                "afterend",
                regenerateButton
              );
              regenerateButton.style.marginTop = "8px"; // Restore top margin for this fallback
              console.log(
                "Quick GPT Reply: Regenerate button injected (fallback placement)."
              );
            } else {
              console.warn(
                "Quick GPT Reply: Could not find textarea parent for fallback injection of regenerate button."
              );
            }
          }
        } else {
          console.log("Quick GPT Reply: Regenerate button already exists.");
        }
        // --- END: Added for Task 12 (Regenerate Button UI) ---
      } else {
        console.warn(
          "Quick GPT Reply: Could not find post button in modal to check its state."
        );
      }
    }
  } catch (error) {
    console.error("Quick GPT Reply: Error during injectReply process:", error);
    alert(
      "Quick GPT Reply: Could not automatically fill the reply box. Please check the page and try again."
    );
  }
}

function createQuickReplyButton() {
  // --- START: Added for Subtask 7.1 ---
  injectSpinnerStyles(); // Ensure styles are injected
  // --- END: Added for Subtask 7.1 ---

  const button = document.createElement("button");
  button.className = "quick-gpt-reply-button"; // As specified

  // --- START: Modified for Subtask 7.1 ---
  const buttonTextSpan = document.createElement("span");
  buttonTextSpan.className = "quick-reply-button-text";
  buttonTextSpan.textContent = "Quick Reply";

  const spinnerElement = document.createElement("span");
  spinnerElement.className = "quick-reply-spinner";
  spinnerElement.style.display = "none"; // Hidden by default

  button.appendChild(spinnerElement);
  button.appendChild(buttonTextSpan);
  // --- END: Modified for Subtask 7.1 ---

  // Styling from parent task, potentially adjustable
  button.style.cssText =
    "margin-left: 8px; padding: 4px 8px; border-radius: 16px; background-color: #1da1f2; color: white; border: none; cursor: pointer; font-size: 14px; line-height: 1; display: inline-flex; align-items: center; justify-content: center;"; // Added flex properties for alignment

  // Hover effect
  button.addEventListener("mouseover", () => {
    button.style.backgroundColor = "#0c85d0"; // Darker blue
  });
  button.addEventListener("mouseout", () => {
    button.style.backgroundColor = "#1da1f2"; // Original blue
  });

  // Add click listener for Subtask 3.1
  button.addEventListener("click", handleQuickReplyClick);

  return button;
}

function findTweetActionBars() {
  const eligibleActionContainers = [];
  // Select all elements that could be a tweet's reply action icon/button
  const potentialActionBars = document.querySelectorAll(
    '[data-testid="reply"]'
  );

  potentialActionBars.forEach((actionBar) => {
    // Find the closest parent element that groups all action buttons (reply, retweet, like, etc.)
    const actionContainer = actionBar.closest('[role="group"]');

    if (actionContainer) {
      // Check if our Quick Reply button has NOT already been added to this container
      if (!actionContainer.querySelector(".quick-gpt-reply-button")) {
        eligibleActionContainers.push(actionContainer);
      }
    }
  });
  return eligibleActionContainers;
}

function injectButtonsIntoTweets() {
  // console.log('Attempting to inject buttons...'); // Optional: for debugging
  const eligibleActionContainers = findTweetActionBars(); // From subtask 2.2

  if (eligibleActionContainers.length > 0) {
    // console.log(`Found ${eligibleActionContainers.length} places to inject buttons.`); // Optional
  }

  eligibleActionContainers.forEach((container) => {
    const button = createQuickReplyButton(); // From subtask 2.1
    container.appendChild(button);
    // console.log('Button injected into:', container); // Optional
  });
}

// Initial run
// initializeScript(); // Moving this call lower

// --- MutationObserver Setup ---

// Create a new MutationObserver instance linked to the callback function
// const observer = new MutationObserver(mutationObserverCallback); // MOVED into startObserver

// --- START: Added/Modified for Subtask 8.1 ---
let mainObserver = null; // Store observer globally
const DEBOUNCE_DELAY = 300; // 300ms for debouncing injectButtonsIntoTweets

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    const context = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(context, args), delay);
  };
}

// Debounced version of injectButtonsIntoTweets
const debouncedInjectButtons = debounce(
  injectButtonsIntoTweets,
  DEBOUNCE_DELAY
);
// --- END: Added/Modified for Subtask 8.1 ---

// Configuration for the observer:
// childList: true to observe additions/removals of child nodes.
// subtree: true to observe changes in all descendants of the target.
const observerConfig = { childList: true, subtree: true };

// Target node to observe (the entire document body in this case)
// const targetNode = document.body; // MOVED into startObserver

// Function to start observing
// --- START: Modified for Subtask 8.1 ---
function startObserver() {
  let targetNode = document.querySelector(
    '[aria-label*="Timeline"], [data-testid="primaryColumn"]'
  );
  // Try specific timeline containers, fallback to primaryColumn

  if (!targetNode) {
    console.warn(
      "Quick GPT Reply: Could not find specific timeline container ([aria-label*='Timeline'] or [data-testid='primaryColumn']). Falling back to document.body for MutationObserver."
    );
    targetNode = document.body;
  }

  if (targetNode) {
    if (mainObserver) {
      console.log("Quick GPT Reply: Disconnecting previous MutationObserver.");
      mainObserver.disconnect();
    }
    mainObserver = new MutationObserver(mutationObserverCallback);
    console.log(
      "Quick GPT Reply: Starting MutationObserver on target:",
      targetNode
    );
    try {
      mainObserver.observe(targetNode, observerConfig);
    } catch (error) {
      console.error(
        "Quick GPT Reply: Error starting MutationObserver:",
        error,
        "on target:",
        targetNode
      );
      mainObserver = null; // Ensure it's null if observe fails
    }
  } else {
    // This case should ideally not be reached if document.body is the ultimate fallback and always exists.
    console.error(
      "Quick GPT Reply: Could not find a valid target node (including document.body) to start MutationObserver."
    );
  }
}

function disconnectObserver() {
  if (mainObserver) {
    mainObserver.disconnect();
    mainObserver = null;
    console.log("Quick GPT Reply: MutationObserver disconnected.");
  }
}
// --- END: Modified for Subtask 8.1 ---

// --- End of MutationObserver Setup ---

// Moved initializeScript definition and call after MutationObserver setup

let lastUrl = location.href; // Store the current URL

function handleUrlChange() {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    console.log(
      `Quick GPT Reply: URL changed from ${lastUrl} to ${currentUrl}. Re-injecting buttons.`
    );
    lastUrl = currentUrl;
    // Delay slightly to allow new page content to render
    setTimeout(() => {
      try {
        injectButtonsIntoTweets();
      } catch (e) {
        console.error(
          "Quick GPT Reply: Error during injectButtonsIntoTweets after URL change:",
          e
        );
      }
    }, 1000); // 1-second delay, adjust if needed
  }
}

function initializeScript() {
  console.log("Quick GPT Reply: Initializing on page/navigation.");

  // Initial injection for already loaded tweets (after a delay)
  console.log("Quick GPT Reply: Scheduling initial button injection.");
  setTimeout(() => {
    console.log("Quick GPT Reply: Running initial injectButtonsIntoTweets().");
    try {
      injectButtonsIntoTweets();
    } catch (e) {
      console.error(
        "Quick GPT Reply: Error during initial injectButtonsIntoTweets():",
        e
      );
    }
  }, 2000); // 2-second delay, adjust if needed

  // Start the MutationObserver to watch for dynamically loaded tweets
  console.log("Quick GPT Reply: Starting MutationObserver.");
  try {
    startObserver();
  } catch (e) {
    console.error("Quick GPT Reply: Error starting MutationObserver:", e);
  }

  // Listen for URL changes to handle SPA navigation
  window.addEventListener("popstate", handleUrlChange);
  // Also, set up an interval to check for URL changes, as not all SPA navigations trigger popstate
  setInterval(handleUrlChange, 1000); // Check every second

  // Placeholder: Detect if viewing a tweet
  // ---------------------------------------
  // Example: Check URL or specific DOM elements to determine context
  // if (isViewingTweet()) {
  //   console.log('Currently viewing a tweet.');
  //   // Add UI elements or other logic here
  // }

  // Placeholder: DOM Manipulation & UI Injection
  // -------------------------------------------
  // Example: Find the reply box and add a button
  // const replyBox = document.querySelector('[data-testid="tweetTextarea_0"]');
  // if (replyBox && !document.getElementById('quick-gpt-reply-btn')) {
  //   const gptButton = document.createElement('button');
  //   gptButton.id = 'quick-gpt-reply-btn';
  //   gptButton.textContent = 'Get Suggestion';
  //   gptButton.onclick = () => {
  //     // Placeholder: Send message to background script
  //     // chrome.runtime.sendMessage({ action: "getSuggestion", tweetText: 'some text' }, (response) => {
  //     //   if (chrome.runtime.lastError) {
  //     //     console.error(chrome.runtime.lastError.message);
  //     //   } else {
  //     //     console.log('Suggestion received:', response.suggestion);
  //     //     // Populate reply box or display suggestion
  //     //   }
  //     // });
  //   };
  //   replyBox.parentElement.appendChild(gptButton);
  // }

  // Placeholder: Message Passing to background.js
  // ---------------------------------------------
  // See example in button click handler above.
}

// Initial run
initializeScript();

console.log("Quick GPT Reply content script setup complete.");

// TEMPORARY TEST CODE for createQuickReplyButton
// if (typeof createQuickReplyButton === 'function') {
//   try {
//     const testButton = createQuickReplyButton();
//     document.body.appendChild(testButton);
//     console.log('Test button appended by content.js');
//   } catch (e) {
//     console.error('Error creating/appending test button:', e);
//   }
// } else {
//   console.error('createQuickReplyButton is not defined in content.js scope');
// }

// TEMPORARY TEST CODE for findTweetActionBars
// function runDetectionTest() {
//   try {
//     const targets = findTweetActionBars();
//     console.log("Eligible tweet action containers:", targets);
//     if (targets && targets.length > 0) {
//       targets.forEach(target => console.log("Found target:", target));
//       console.log("SUCCESS: Targets found!");
//     } else {
//       console.log("No eligible targets found yet...");
//     }
//   } catch (e) {
//     console.error("Error testing findTweetActionBars:", e);
//   }
// }
//
// // Run the test a few times with delays
// console.log("Starting findTweetActionBars test with delays...");
// setTimeout(runDetectionTest, 1000); // Test after 1 second
// setTimeout(runDetectionTest, 3000); // Test after 3 seconds
// setTimeout(runDetectionTest, 5000); // Test after 5 seconds

// TEMPORARY TEST CODE for injectButtonsIntoTweets
// console.log("Setting up temporary test for injectButtonsIntoTweets...");
// setTimeout(() => {
//   console.log("Running injectButtonsIntoTweets via setTimeout...");
//   try {
//     injectButtonsIntoTweets();
//   } catch (e) {
//     console.error("Error during injectButtonsIntoTweets test:", e);
//   }
// }, 3000); // 3-second delay, adjust if needed

function mutationObserverCallback(mutationsList, observer) {
  // We are primarily interested if new nodes were added that might contain tweets.
  let newNodesAdded = false;
  for (const mutation of mutationsList) {
    if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
      newNodesAdded = true;
      break;
    }
  }

  if (newNodesAdded) {
    // console.log('DOM changes detected (nodes added), attempting to inject buttons.'); // Optional for debugging
    try {
      // injectButtonsIntoTweets(); // Call our existing injection function // MODIFIED for 8.1
      debouncedInjectButtons(); // USE DEBOUNCED VERSION for 8.1
    } catch (error) {
      console.error(
        "Quick GPT Reply: Error during injectButtonsIntoTweets from MutationObserver:",
        error
      );
      // Optional: Consider if the observer should be disconnected if errors persist
      // observer.disconnect();
    }
  }
}

// --- START: Added for Task 12 (Regenerate Button UI) ---
function createRegenerateButton(tweetModal, replyTextarea, originalTweetText) {
  injectSpinnerStyles(); // Ensure spinner styles are available

  const button = document.createElement("button");
  button.className = "quick-gpt-regenerate-button";
  button.setAttribute("data-original-tweet-text", originalTweetText); // Store original tweet for re-prompting

  const buttonTextSpan = document.createElement("span");
  buttonTextSpan.className = "quick-reply-button-text"; // Reuse class for consistency if desired
  buttonTextSpan.textContent = "Regenerate";

  const spinnerElement = document.createElement("span");
  spinnerElement.className = "quick-reply-spinner"; // Reuse spinner
  spinnerElement.style.display = "none";

  button.appendChild(spinnerElement);
  button.appendChild(buttonTextSpan);

  // Styling - adjust as needed, make it distinct from main Quick Reply
  button.style.cssText =
    "padding: 4px 8px; border-radius: 16px; background-color: #1da1f2; color: white; border: none; cursor: pointer; font-size: 12px; line-height: 1; display: inline-flex; align-items: center; justify-content: center;";

  // Hover effect
  button.addEventListener("mouseover", () => {
    button.style.backgroundColor = "#0c85d0"; // Darker blue
  });
  button.addEventListener("mouseout", () => {
    button.style.backgroundColor = "#1da1f2"; // Original blue
  });

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await handleRegenerateClick(
      event,
      tweetModal,
      replyTextarea,
      originalTweetText
    );
  });

  return button;
}

async function handleRegenerateClick(
  event,
  tweetModal,
  replyTextarea,
  originalTweetText
) {
  const button = event.currentTarget;
  const buttonTextSpan = button.querySelector(".quick-reply-button-text");
  const spinnerElement = button.querySelector(".quick-reply-spinner");
  const originalButtonText = buttonTextSpan
    ? buttonTextSpan.textContent
    : "Regenerate";
  const originalButtonBackgroundColor = button.style.backgroundColor;

  function resetButtonState() {
    if (buttonTextSpan) {
      buttonTextSpan.textContent = originalButtonText;
      buttonTextSpan.style.display = "inline";
    }
    if (spinnerElement) spinnerElement.style.display = "none";
    button.style.backgroundColor = originalButtonBackgroundColor;
    button.disabled = false;
  }

  // Loading State Start
  if (buttonTextSpan) buttonTextSpan.style.display = "none";
  if (spinnerElement) spinnerElement.style.display = "inline-block";
  button.disabled = true;

  console.log(
    "Quick GPT Reply: Regenerate button clicked. Original tweet:",
    originalTweetText
  );

  // Placeholder for actually calling the generation logic
  // In a real scenario, this would message the background script
  // and then use injectReply or a similar mechanism to update the textarea.
  try {
    // Simulate API call delay
    // await new Promise(resolve => setTimeout(resolve, 1500));
    // const newReply = "This is a newly regenerated reply!";

    // Send message to background script to get a new reply
    chrome.runtime.sendMessage(
      { action: "generateReply", tweetContent: originalTweetText }, // Re-use original tweet content
      async (response) => {
        // Made this callback async
        if (chrome.runtime.lastError) {
          console.error(
            "Quick GPT Reply (Regenerate): Error sending message:",
            chrome.runtime.lastError.message
          );
          if (buttonTextSpan) buttonTextSpan.textContent = "Error";
          button.style.backgroundColor = "#FF6B6B";
          setTimeout(resetButtonState, 2000);
          return;
        }

        if (response && response.success) {
          console.log("Quick GPT Reply (Regenerate) received:", response.reply);
          // Clear existing content of textarea before injecting new reply
          if (replyTextarea) {
            replyTextarea.focus();
            await new Promise((r) => setTimeout(r, 100)); // Ensure focus

            const selection = window.getSelection();
            const range = document.createRange();
            let clearedViaExec = false;
            try {
              range.selectNodeContents(replyTextarea);
              selection.removeAllRanges();
              selection.addRange(range);
              await new Promise((r) => setTimeout(r, 50)); // Allow selection to process

              console.log(
                "Quick GPT Reply (Regenerate): Attempting to clear content via execCommand('delete')."
              );
              if (
                document.queryCommandSupported &&
                document.queryCommandSupported("delete")
              ) {
                clearedViaExec = document.execCommand("delete", false, null);
              }

              if (clearedViaExec) {
                console.log(
                  "Quick GPT Reply (Regenerate): Cleared textarea using execCommand('delete')."
                );
              } else {
                console.warn(
                  "Quick GPT Reply (Regenerate): execCommand('delete') failed or not supported for clearing. Trying manual clear by deleting selection."
                );
                // Fallback: if execCommand delete fails, manually clear the selection
                if (
                  selection.rangeCount > 0 &&
                  selection.getRangeAt(0).toString() !== ""
                ) {
                  selection.deleteFromDocument();
                  console.log(
                    "Quick GPT Reply (Regenerate): Manually cleared selection via deleteFromDocument()."
                  );
                } else if (replyTextarea.innerHTML !== "") {
                  // Last resort if selection is tricky
                  replyTextarea.innerHTML = "";
                  console.warn(
                    "Quick GPT Reply (Regenerate): Cleared via innerHTML as final fallback."
                  );
                } else {
                  console.log(
                    "Quick GPT Reply (Regenerate): Textarea already appeared empty or selection clear failed."
                  );
                }
              }
            } catch (e) {
              console.error(
                "Quick GPT Reply (Regenerate): Error selecting/clearing content.",
                e
              );
              // Fallback to a simple clear, though it might have issues.
              replyTextarea.innerHTML = "";
              console.warn(
                "Quick GPT Reply (Regenerate): Fell back to innerHTML clearing due to error during selection/execCommand."
              );
            }

            // Dispatch input event after clearing to notify React
            replyTextarea.dispatchEvent(
              new Event("input", { bubbles: true, cancelable: true })
            );
            console.log(
              "Quick GPT Reply (Regenerate): Dispatched 'input' event after clearing attempt."
            );
            await new Promise((r) => setTimeout(r, 50)); // allow state to settle
          }
          // Re-use injectReply logic but only for pasting, not clicking reply again
          // We need a more direct way to paste into the already open modal's textarea
          await pasteTextIntoTextarea(replyTextarea, response.reply);
          resetButtonState();
        } else {
          const errorMessage =
            response?.error || "Unknown error regenerating reply.";
          console.error(
            "Quick GPT Reply (Regenerate): Failed to generate new reply:",
            errorMessage
          );
          if (buttonTextSpan) buttonTextSpan.textContent = "Error";
          button.style.backgroundColor = "#FF6B6B";
          setTimeout(resetButtonState, 2000);
        }
      }
    );
  } catch (error) {
    console.error("Quick GPT Reply: Error during regeneration:", error);
    if (buttonTextSpan) buttonTextSpan.textContent = "Error";
    button.style.backgroundColor = "#FF6B6B";
    setTimeout(resetButtonState, 2000);
  }
}

// Helper to paste text, similar to what injectReply does but more direct
async function pasteTextIntoTextarea(textarea, text) {
  if (!textarea || typeof text === "undefined") {
    console.error("Quick GPT Reply: Textarea or text missing for paste.");
    return;
  }
  textarea.focus();
  // Increased delay slightly to ensure focus and any subsequent selection changes settle
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log(
    "Quick GPT Reply (Regenerate): Attempting to paste using execCommand('insertText')."
  );
  let pastedSuccessfully = false;
  try {
    // Ensure the element is actually focused from the document's perspective.
    if (document.activeElement !== textarea) {
      console.warn(
        "Quick GPT Reply (Regenerate): Textarea was not document.activeElement before execCommand. Refocusing."
      );
      textarea.focus();
      await new Promise((resolve) => setTimeout(resolve, 50)); // Short delay after refocus
    }

    if (
      document.queryCommandSupported &&
      document.queryCommandSupported("insertText")
    ) {
      pastedSuccessfully = document.execCommand("insertText", false, text);
      if (pastedSuccessfully) {
        console.log(
          "Quick GPT Reply (Regenerate): Pasted successfully using execCommand('insertText')."
        );
      } else {
        console.warn(
          "Quick GPT Reply (Regenerate): execCommand('insertText') returned false (element might not be focused or editable)."
        );
      }
    } else {
      console.warn(
        "Quick GPT Reply (Regenerate): execCommand('insertText') is not supported by the browser."
      );
    }
  } catch (e) {
    console.error(
      "Quick GPT Reply (Regenerate): Error during execCommand('insertText'):",
      e
    );
    pastedSuccessfully = false; // Ensure it's false if an error occurred
  }

  if (!pastedSuccessfully) {
    console.warn(
      "Quick GPT Reply (Regenerate): Falling back to DataTransfer paste event method due to execCommand failure or non-support."
    );
    // This is the original problematic "Minimalist Paste"
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", text);
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });
      textarea.dispatchEvent(pasteEvent);
      console.log(
        "Quick GPT Reply (Regenerate): Fallback paste event dispatched."
      );
      // If this path is taken, the known errors will likely re-occur.
    } catch (e) {
      console.error(
        "Quick GPT Reply (Regenerate): Error during fallback DataTransfer paste:",
        e
      );
      // Final fallback: direct manipulation (less ideal for rich text)
      console.warn(
        "Quick GPT Reply (Regenerate): Falling back to textContent assignment as last resort."
      );
      textarea.textContent = text; // This might mess up rich text formatting, but better than nothing.
    }
  }

  // Always dispatch input and change events to notify React/frameworks
  // Consider a small delay before these to let the paste action (execCommand or event) settle
  await new Promise((resolve) => setTimeout(resolve, 50));
  textarea.dispatchEvent(
    new Event("input", { bubbles: true, cancelable: true })
  );
  // 'change' event is often less critical immediately after programmatic input for some frameworks
  // but can be dispatched for completeness.
  textarea.dispatchEvent(
    new Event("change", { bubbles: true, cancelable: true })
  );
  console.log(
    "Quick GPT Reply (Regenerate): Final input/change events dispatched after paste attempt."
  );
}
// --- END: Added for Task 12 (Regenerate Button UI) ---
