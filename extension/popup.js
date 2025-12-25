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
  
    // 3. Send a message to the content script to scrape text
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: "scrape_page" });
      
      if (response && response.success) {
        statusDiv.textContent = "Scraped! Sending to Python...";
        console.log("Scraped Text Length:", response.text.length);
        
        // 4. Create FormData and append file and job text
        const formData = new FormData();
        formData.append("file", cvFileInput.files[0]);
        formData.append("job_text", response.text);
        
        // 5. Send FormData to the FastAPI Backend
        try {
          const apiResponse = await fetch("http://127.0.0.1:8000/analyze", {
              method: "POST",
              body: formData
              // Note: Don't set Content-Type header - browser sets it automatically with boundary for FormData
          });

          if (!apiResponse.ok) {
              throw new Error(`Server error: ${apiResponse.status}`);
          }

          const data = await apiResponse.json();
          
          // 6. Update UI with the response from Python
          statusDiv.textContent = data.message || `CV text: ${data.cv_text_length} chars, Job text: ${data.job_text_length} chars`;
          
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