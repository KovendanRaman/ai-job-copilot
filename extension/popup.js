document.getElementById("scrapeBtn").addEventListener("click", async () => {
    const statusDiv = document.getElementById("status");
    statusDiv.textContent = "Analyzing...";
  
    // 1. Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
    if (!tab) {
      statusDiv.textContent = "Error: No active tab found.";
      return;
    }
  
    // 2. Send a message to the content script to scrape text
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: "scrape_page" });
      
      if (response && response.success) {
        statusDiv.textContent = "Scraped! Sending to Python...";
        console.log("Scraped Text Length:", response.text.length);
        
        // 3. Send the scraped text to the FastAPI Backend
        try {
          const apiResponse = await fetch("http://127.0.0.1:8000/analyze", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json"
              },
              body: JSON.stringify({ text: response.text })
          });
  
          if (!apiResponse.ok) {
              throw new Error(`Server error: ${apiResponse.status}`);
          }
  
          const data = await apiResponse.json();
          
          // 4. Update UI with the response from Python
          statusDiv.textContent = `Python says: ${data.message} (${data.char_count} chars)`;
          
        } catch (err) {
          statusDiv.textContent = "Error connecting to Python backend.";
          console.error("Fetch Error:", err);
        }
  
      } else {
        statusDiv.textContent = "Error: could not scrape page.";
      }
    } catch (error) {
      statusDiv.textContent = "Error: " + error.message;
      console.error("Communication failed:", error);
      
      // Hint for common error:
      if (error.message.includes("Could not establish connection")) {
          statusDiv.textContent = "Please refresh the job page and try again.";
      }
    }
  });