document.getElementById("scrapeBtn").addEventListener("click", async () => {
    const statusDiv = document.getElementById("status");
    const cvFileInput = document.getElementById("cvFile");
    
    statusDiv.textContent = "Analyzing...";
  
    // 1. Check if CV file is selected
    if (!cvFileInput.files || cvFileInput.files.length === 0) {
      statusDiv.textContent = "Error: Please select a PDF file first.";
      return;
    }
  
    // 2. Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
    if (!tab) {
      statusDiv.textContent = "Error: No active tab found.";
      return;
    }

    // Check if we're on a forbidden page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
      statusDiv.textContent = "Error: Cannot run on this page. Please open a job posting page.";
      return;
    }
  
    // 3. Send a message to the content script to scrape text
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: "scrape_page" });
      
      if (response && response.success) {
        const scrapedText = response.text;
        statusDiv.textContent = "Scraped! Sending to Python...";
        console.log("Scraped Text Length:", scrapedText.length);
        
        // 4. Create FormData and append file and job text
        const formData = new FormData();
        formData.append("file", cvFileInput.files[0]);
        formData.append("job_text", scrapedText);
        
        // 5. Send FormData to the FastAPI Backend
        try {
          const apiResponse = await fetch("http://127.0.0.1:8000/analyze", {
              method: "POST",
              body: formData
          });

          if (!apiResponse.ok) {
              throw new Error(`Server error: ${apiResponse.status}`);
          }

          const data = await apiResponse.json();
          
          // 6. Update UI with the response from Python
          if (data.match_score !== undefined) {
            statusDiv.textContent = `Match Score: ${data.match_score}%`;
            statusDiv.style.fontSize = "16px";
            statusDiv.style.fontWeight = "bold";
            // Color coding: green for good match, orange for moderate, red for low
            if (data.match_score >= 50) {
              statusDiv.style.color = "green";
            } else if (data.match_score >= 30) {
              statusDiv.style.color = "orange";
            } else {
              statusDiv.style.color = "red";
            }
          } else {
            statusDiv.textContent = `CV: ${data.cv_text_length} chars, Job: ${data.job_text_length} chars`;
          }
          
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
      
      // More helpful error messages
      if (error.message.includes("Cannot access")) {
          statusDiv.textContent = "Cannot access this page. Please refresh the job page and try again.";
      } else if (error.message.includes("scripting")) {
          statusDiv.textContent = "Extension error. Please refresh the page (F5) and try again.";
      }
    }
  });