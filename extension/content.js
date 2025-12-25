// content.js
console.log("AI Job Copilot: Content script active.");

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape_page") {
    
    // Simple scraping strategy: Get all visible text
    // Later we can refine this to target specific divs
    const pageText = document.body.innerText;
    
    console.log("Scraping page content...");
    
    // Send the text back to the popup
    sendResponse({ success: true, text: pageText });
  }
  return true; // Keep the message channel open for async response
});